// Server-side handling of a batch of commands, independent of any hosting platform.
// supabase/functions/sync/index.ts connects it to Supabase.
import type { RecordedCommand } from "../game/commands";
import type { GameState } from "../game/model";
import { replayCommands, type ReplayRejection } from "../game/replay";

export const MAX_BATCH_COMMANDS = 500;

export interface StoredGame {
  state: GameState;
  revision: number;
  lastSeq: number;
  lastAt: number;
}

export interface StoredBatch {
  revision: number;
  lastSeq: number;
}

export interface SyncStore {
  loadGame(playerId: string): Promise<StoredGame | null>;
  findBatch(playerId: string, batchId: string): Promise<StoredBatch | null>;
  loadCommands(playerId: string, fromSeq: number, toSeq: number): Promise<RecordedCommand[]>;
  /** Saves atomically. Returns false if the revision has since moved on. */
  commit(
    playerId: string,
    update: StoredGame & {
      expectedRevision: number;
      batchId: string;
      firstSeq: number;
      commands: RecordedCommand[];
    },
  ): Promise<boolean>;
}

export type SyncResponse =
  | { status: "accepted"; revision: number; lastSeq: number; state: GameState }
  | { status: "already-applied"; revision: number; lastSeq: number }
  | { status: "conflict"; revision: number; lastSeq: number }
  | { status: "no-game" }
  | { status: "invalid-request" }
  | { status: "rejected"; reason: ReplayRejection; seq: number | null; detail?: string };

const BATCH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readSeq(entry: unknown): number | null {
  if (entry === null || typeof entry !== "object") return null;
  const seq = (entry as { seq?: unknown }).seq;
  return Number.isSafeInteger(seq) ? Number(seq) : null;
}

/**
 * The caller must have authenticated the player already. `receivedAt` is the server's
 * clock, never a value from the client.
 */
export async function handleSync(
  store: SyncStore,
  playerId: string,
  body: unknown,
  receivedAt: number,
): Promise<SyncResponse> {
  if (body === null || typeof body !== "object") return { status: "invalid-request" };
  const { batchId, baseRevision, commands } = body as Record<string, unknown>;
  if (
    typeof batchId !== "string" ||
    !BATCH_ID.test(batchId) ||
    !Number.isSafeInteger(baseRevision) ||
    !Array.isArray(commands) ||
    commands.length === 0 ||
    commands.length > MAX_BATCH_COMMANDS
  ) {
    return { status: "invalid-request" };
  }

  const finished = await store.findBatch(playerId, batchId);
  if (finished) {
    return { status: "already-applied", revision: finished.revision, lastSeq: finished.lastSeq };
  }

  const game = await store.loadGame(playerId);
  if (!game) return { status: "no-game" };
  // A different device moved on. Nothing is overwritten; the client must resolve this.
  if (baseRevision !== game.revision) {
    return { status: "conflict", revision: game.revision, lastSeq: game.lastSeq };
  }

  const seqs = commands.map(readSeq).filter((seq): seq is number => seq !== null);
  const firstSeq = seqs.length > 0 ? Math.min(...seqs) : game.lastSeq + 1;
  const knownCommands =
    firstSeq <= game.lastSeq
      ? await store.loadCommands(playerId, firstSeq, game.lastSeq)
      : [];

  const replay = replayCommands(
    { state: game.state, lastSeq: game.lastSeq, lastAt: game.lastAt },
    commands,
    { receivedAt, knownCommands },
  );
  if (replay.status === "rejected") return replay;
  if (replay.applied.length === 0) {
    return { status: "already-applied", revision: game.revision, lastSeq: game.lastSeq };
  }

  const revision = game.revision + 1;
  const saved = await store.commit(playerId, {
    state: replay.state,
    revision,
    lastSeq: replay.lastSeq,
    lastAt: replay.lastAt,
    expectedRevision: game.revision,
    batchId,
    firstSeq: replay.applied[0].seq,
    commands: replay.applied,
  });
  if (!saved) {
    const latest = await store.loadGame(playerId);
    return {
      status: "conflict",
      revision: latest?.revision ?? game.revision,
      lastSeq: latest?.lastSeq ?? game.lastSeq,
    };
  }
  return { status: "accepted", revision, lastSeq: replay.lastSeq, state: replay.state };
}
