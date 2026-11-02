import { syncSelectedShip, type GameState } from "./model";
import { validateSave } from "./save-format";
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

export function saveGame(state: GameState): Promise<void> {
  const synchronizedState = syncSelectedShip(state);
  return enqueueWrite(() =>
    runWriteTransaction((store) => {
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
          store.delete(ALL_LOG_ENTRIES());
          store.put(syncSelectedShip(game), SAVE_KEY);
          store.put(syncSelectedShip(game), LOG_BASE_KEY);
          store.put(log, LOG_META_KEY);
          session = { game, log, resumedVoyage: null };
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
    runWriteTransaction((store) => {
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
    runWriteTransaction((store) => {
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
