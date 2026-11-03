import { syncSelectedShip, type GameState } from "./model";
import { NewerSaveError, isNewerSave, validateSave } from "./save-format";
import type { RecordedCommand } from "./commands";

const DATABASE_NAME = "bengal-trader";
const DATABASE_VERSION = 2;
const SAVE_STORE = "save";
const SAVE_KEY = "captain";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("This browser does not support offline game saves."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Could not open game save."));
    request.onblocked = () =>
      reject(new Error("Close another game tab to access your saved voyage."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SAVE_STORE)) {
        database.createObjectStore(SAVE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runWriteTransaction(
  write: (store: IDBObjectStore) => void,
): Promise<void> {
  return openDatabase().then(
    (database) =>
      new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(SAVE_STORE, "readwrite");
        try {
          write(transaction.objectStore(SAVE_STORE));
        } catch (error) {
          transaction.onabort = () => {
            database.close();
            reject(error);
          };
          transaction.abort();
          return;
        }
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error("Could not save your voyage."));
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error("Saving your voyage failed."));
        };
      }),
  );
}

// Writes run strictly in order, so a slow save can't overtake a newer one.
let writeQueue: Promise<unknown> = Promise.resolve();

/** Resolves once every write requested so far has finished. */
export async function whenStorageIdle(): Promise<void> {
  await writeQueue;
}

function enqueueWrite(task: () => Promise<void>): Promise<void> {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => undefined);
  return next;
}

export async function loadGame(): Promise<GameState | null> {
  await writeQueue;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SAVE_STORE, "readonly");
    const request = transaction.objectStore(SAVE_STORE).get(SAVE_KEY);
    request.onerror = () => reject(request.error ?? new Error("Could not read game save."));
    request.onsuccess = () => {
      try {
        resolve(request.result === undefined ? null : validateSave(request.result));
      } catch (error) {
        reject(error);
      } finally {
        database.close();
      }
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Reading the game save failed."));
    };
  });
}

// A tab left open across an update mustn't overwrite the newer save another tab upgraded.
function writeUnlessNewer(write: (store: IDBObjectStore) => void): Promise<void> {
  let refused = false;
  return runWriteTransaction((store) => {
    const current = store.get(SAVE_KEY);
    current.onsuccess = () => {
      if (isNewerSave(current.result)) {
        refused = true;
        store.transaction.abort();
        return;
      }
      write(store);
    };
  }).catch((error: unknown) => {
    throw refused ? new NewerSaveError() : error;
  });
}

export function saveGame(state: GameState): Promise<void> {
  const synchronizedState = syncSelectedShip(state);
  return enqueueWrite(() =>
    writeUnlessNewer((store) => {
      store.put(synchronizedState, SAVE_KEY);
    }),
  );
}

// The command log lives beside the save in the same object store, and is written in
// the same transaction, so the saved game always equals its base plus its commands.
const LOG_META_KEY = "command-log:meta";
const LOG_BASE_KEY = "command-log:base";
const LOG_ENTRY_PREFIX = "command-log:entry:";
const MAX_LOG_ENTRIES = 50_000;

function logEntryKey(seq: number): string {
  return `${LOG_ENTRY_PREFIX}${String(seq).padStart(12, "0")}`;
}

const ALL_LOG_ENTRIES = () =>
  IDBKeyRange.bound(LOG_ENTRY_PREFIX, `${LOG_ENTRY_PREFIX}\uffff`);

export interface CommandLogMeta {
  formatVersion: 1;
  /** "recorded" history starts from a new game; "imported" began from an existing save. */
  provenance: "recorded" | "imported";
  /** Commands up to this number are already part of the base state. */
  baseSeq: number;
  nextSeq: number;
  lastAt: number;
}

// The original of any save that gets replaced stays here, beside the save and outside the
// command log's keys. A migration writes its backup in the same transaction as the new save,
// so an interruption leaves either both or the untouched original.
const BACKUP_PREFIX = "save-backup:";
const ALL_BACKUPS = () => IDBKeyRange.bound(BACKUP_PREFIX, `${BACKUP_PREFIX}\uffff`);

export type SaveBackupReason = "migration" | "new-game" | "before-restore";

export interface SaveBackup {
  formatVersion: 1;
  reason: SaveBackupReason;
  createdAt: number;
  /** Exactly as it was stored, so a corrected game can upgrade it again. */
  save: unknown;
  log: { meta: unknown; base: unknown; entries: unknown[] };
}

export interface SaveBackupSummary {
  key: string;
  reason: SaveBackupReason;
  createdAt: number;
  saveVersion: number | null;
  captainName: string | null;
}

function backupKey(reason: SaveBackupReason, save: unknown): string {
  const version = (save as { version?: unknown } | null)?.version;
  return reason === "migration"
    ? `${BACKUP_PREFIX}migration:v${String(version)}`
    : `${BACKUP_PREFIX}${reason}`;
}

/** Copies the current save and its log into a backup, then continues inside the transaction. */
function writeBackup(
  store: IDBObjectStore,
  reason: SaveBackupReason,
  at: number,
  then: () => void,
): void {
  const save = store.get(SAVE_KEY);
  const meta = store.get(LOG_META_KEY);
  const base = store.get(LOG_BASE_KEY);
  const entries = store.getAll(ALL_LOG_ENTRIES());
  entries.onsuccess = () => {
    if (save.result !== undefined) {
      const backup: SaveBackup = {
        formatVersion: 1,
        reason,
        createdAt: at,
        save: save.result,
        log: { meta: meta.result, base: base.result, entries: entries.result },
      };
      store.put(backup, backupKey(reason, save.result));
    }
    then();
  };
}

function readOnly<T>(read: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const request = read(database.transaction(SAVE_STORE, "readonly").objectStore(SAVE_STORE));
        request.onerror = () => {
          database.close();
          reject(request.error ?? new Error("Could not read your saved voyage."));
        };
        request.onsuccess = () => {
          database.close();
          resolve(request.result);
        };
      }),
  );
}

/** The save as stored, even if this version of the game can't load it. */
export async function readRawSave(): Promise<unknown> {
  await writeQueue;
  return readOnly((store) => store.get(SAVE_KEY));
}

export async function readSaveBackup(key: string): Promise<SaveBackup | undefined> {
  await writeQueue;
  return readOnly((store) => store.get(key));
}

export async function listSaveBackups(): Promise<SaveBackupSummary[]> {
  await writeQueue;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const store = database.transaction(SAVE_STORE, "readonly").objectStore(SAVE_STORE);
    const keys = store.getAllKeys(ALL_BACKUPS());
    const values = store.getAll(ALL_BACKUPS());
    values.onerror = () => {
      database.close();
      reject(values.error ?? new Error("Could not read your save backups."));
    };
    values.onsuccess = () => {
      database.close();
      resolve(
        (values.result as SaveBackup[])
          .map((backup, index) => {
            const save = backup.save as { version?: unknown; captainName?: unknown } | null;
            return {
              key: String(keys.result[index]),
              reason: backup.reason,
              createdAt: backup.createdAt,
              saveVersion: typeof save?.version === "number" ? save.version : null,
              captainName: typeof save?.captainName === "string" ? save.captainName : null,
            };
          })
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    };
  });
}

/**
 * Puts a backup back as the current save, with its command log, keeping what it replaced as a
 * backup too. The next load upgrades it again in the normal way.
 */
export function restoreSaveBackup(key: string, now = Date.now()): Promise<void> {
  return enqueueWrite(() =>
    runWriteTransaction((store) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const backup = request.result as SaveBackup | undefined;
        if (!backup || isNewerSave(backup.save)) {
          store.transaction.abort();
          return;
        }
        writeBackup(store, "before-restore", now, () => {
          store.delete(ALL_LOG_ENTRIES());
          store.put(backup.save, SAVE_KEY);
          if (backup.log.meta === undefined) store.delete(LOG_META_KEY);
          else store.put(backup.log.meta, LOG_META_KEY);
          if (backup.log.base === undefined) store.delete(LOG_BASE_KEY);
          else store.put(backup.log.base, LOG_BASE_KEY);
          for (const entry of backup.log.entries as RecordedCommand[]) {
            store.put(entry, logEntryKey(entry.seq));
          }
        });
      };
    }),
  );
}

export interface GameSession {
  game: GameState | null;
  log: CommandLogMeta | null;
  /** Set when a saved voyage resumed on load: the entry to record for that resume. */
  resumedVoyage: { pausedAt: number; at: number } | null;
}

/** Loads the save, starting a log for it if it predates commands. */
export async function openGameSession(now = Date.now()): Promise<GameSession> {
  await writeQueue;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SAVE_STORE, "readwrite");
    const store = transaction.objectStore(SAVE_STORE);
    let session: GameSession = { game: null, log: null, resumedVoyage: null };
    const metaRequest = store.get(LOG_META_KEY);
    const saveRequest = store.get(SAVE_KEY);
    saveRequest.onsuccess = () => {
      if (saveRequest.result === undefined) return;
      try {
        const meta = metaRequest.result as CommandLogMeta | undefined;
        const at = Math.max(now, meta?.lastAt ?? 0);
        const game = validateSave(saveRequest.result, at);
        // Replaying old commands under changed rules wouldn't rebuild this game, so a
        // migrated save starts a new history from where it is now.
        const migrated = saveRequest.result.version !== game.version;
        if (meta && !migrated) {
          session = {
            game,
            log: meta,
            resumedVoyage: game.voyage
              ? { pausedAt: saveRequest.result.voyage.progressUpdatedAt, at }
              : null,
          };
        } else {
          const lastSeq = meta ? meta.nextSeq - 1 : 0;
          const log: CommandLogMeta = {
            formatVersion: 1,
            provenance: "imported",
            baseSeq: lastSeq,
            nextSeq: lastSeq + 1,
            lastAt: at,
          };
          const replaceSave = () => {
            store.delete(ALL_LOG_ENTRIES());
            store.put(syncSelectedShip(game), SAVE_KEY);
            store.put(syncSelectedShip(game), LOG_BASE_KEY);
            store.put(log, LOG_META_KEY);
            session = { game, log, resumedVoyage: null };
          };
          if (migrated) {
            writeBackup(store, "migration", at, () => {
              try {
                replaceSave();
              } catch (error) {
                reject(error);
                transaction.abort();
              }
            });
          } else {
            replaceSave();
          }
        }
      } catch (error) {
        reject(error);
        transaction.abort();
      }
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(session);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not read game save."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Reading the game save failed."));
    };
  });
}

/** Starts a fresh history for a brand-new game. */
export function startCommandLog(game: GameState): Promise<void> {
  const state = syncSelectedShip(game);
  return enqueueWrite(() =>
    writeUnlessNewer((store) => {
      // A new game replaces whatever was here, including a save that couldn't be loaded.
      writeBackup(store, "new-game", Date.now(), () => {
        store.delete(ALL_LOG_ENTRIES());
        const log: CommandLogMeta = {
          formatVersion: 1,
          provenance: "recorded",
          baseSeq: 0,
          nextSeq: 1,
          lastAt: 0,
        };
        store.put(state, SAVE_KEY);
        store.put(state, LOG_BASE_KEY);
        store.put(log, LOG_META_KEY);
      });
    }),
  );
}

/** Saves the game and its new commands together, or neither. */
export function commitGame(
  game: GameState,
  commands: readonly RecordedCommand[],
  maxEntries = MAX_LOG_ENTRIES,
): Promise<void> {
  const state = syncSelectedShip(game);
  return enqueueWrite(() =>
    writeUnlessNewer((store) => {
      store.put(state, SAVE_KEY);
      if (commands.length === 0) return;
      const metaRequest = store.get(LOG_META_KEY);
      metaRequest.onsuccess = () => {
        const meta = metaRequest.result as CommandLogMeta | undefined;
        if (!meta) return;
        const last = commands[commands.length - 1];
        if (last.seq - meta.baseSeq > maxEntries) {
          // Too long to replay: this point becomes the new start, and the game
          // can no longer prove its full history.
          store.delete(ALL_LOG_ENTRIES());
          store.put(state, LOG_BASE_KEY);
          store.put(
            { ...meta, provenance: "imported", baseSeq: last.seq, nextSeq: last.seq + 1, lastAt: last.at },
            LOG_META_KEY,
          );
          return;
        }
        for (const entry of commands) store.put(entry, logEntryKey(entry.seq));
        store.put({ ...meta, nextSeq: last.seq + 1, lastAt: last.at }, LOG_META_KEY);
      };
    }),
  );
}

export interface StoredCommandLog {
  meta: CommandLogMeta;
  base: GameState;
  commands: RecordedCommand[];
}

export async function readCommandLog(): Promise<StoredCommandLog | null> {
  await writeQueue;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const store = database
      .transaction(SAVE_STORE, "readonly")
      .objectStore(SAVE_STORE);
    const meta = store.get(LOG_META_KEY);
    const base = store.get(LOG_BASE_KEY);
    const entries = store.getAll(ALL_LOG_ENTRIES());
    entries.onerror = () => {
      database.close();
      reject(entries.error ?? new Error("Could not read the command log."));
    };
    entries.onsuccess = () => {
      database.close();
      resolve(
        meta.result
          ? { meta: meta.result, base: base.result, commands: entries.result }
          : null,
      );
    };
  });
}
