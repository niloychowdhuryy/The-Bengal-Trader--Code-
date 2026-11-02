// Replays recorded commands against the last verified state. Used by the server to
// decide what really happened; a client's claimed results are never read.
import {
  applyCommand,
  parseRecordedCommand,
  type RecordedCommand,
} from "./commands";
import type { GameState } from "./model";
import { isValidGameState } from "./save-format";

export const MAX_CLOCK_AHEAD_MS = 5_000;

export interface ReplayAnchor {
  state: GameState;
  /** Highest sequence number already verified. */
  lastSeq: number;
  /** Time of the last verified command; nothing new may be earlier. */
  lastAt: number;
}

export type ReplayRejection =
  | "malformed-command"
  | "sequence-gap"
  | "sequence-conflict"
  | "invalid-time"
  | "command-refused"
  | "invalid-result";

export type ReplayResult =
  | {
      status: "accepted";
      state: GameState;
      lastSeq: number;
      lastAt: number;
      applied: RecordedCommand[];
      duplicates: number;
    }
  | {
      status: "rejected";
      reason: ReplayRejection;
      seq: number | null;
      detail?: string;
    };

export interface ReplayOptions {
  /** Trusted time the batch reached the server. */
  receivedAt: number;
  /** Commands already verified, used to recognise honest retries. */
  knownCommands?: readonly RecordedCommand[];
}

/**
 * A batch is all or nothing. It can't claim more time than has really passed: times
 * must never go backward and can't be later than the moment it arrived.
 */
export function replayCommands(
  anchor: ReplayAnchor,
  entries: readonly unknown[],
  { receivedAt, knownCommands = [] }: ReplayOptions,
): ReplayResult {
  // Databases may store keys in a different order, so compare rebuilt copies.
  const known = new Map(
    knownCommands.map((entry) => [
      entry.seq,
      JSON.stringify(parseRecordedCommand(entry) ?? entry),
    ]),
  );
  let state = anchor.state;
  let lastSeq = anchor.lastSeq;
  let lastAt = anchor.lastAt;
  let duplicates = 0;
  const applied: RecordedCommand[] = [];

  for (const raw of entries) {
    const entry = parseRecordedCommand(raw);
    if (!entry) return { status: "rejected", reason: "malformed-command", seq: null };

    if (entry.seq <= anchor.lastSeq) {
      // A retry after a lost response is fine, but history can't be rewritten.
      const previous = known.get(entry.seq);
      if (previous !== undefined && previous !== JSON.stringify(entry)) {
        return { status: "rejected", reason: "sequence-conflict", seq: entry.seq };
      }
      duplicates += 1;
      continue;
    }
    if (entry.seq !== lastSeq + 1) {
      return { status: "rejected", reason: "sequence-gap", seq: entry.seq };
    }
    if (entry.at < lastAt || entry.at > receivedAt + MAX_CLOCK_AHEAD_MS) {
      return { status: "rejected", reason: "invalid-time", seq: entry.seq };
    }

    const result = applyCommand(state, entry.command, entry.at);
    if (result.status !== "applied") {
      // Clients only record commands that changed something.
      return {
        status: "rejected",
        reason: "command-refused",
        seq: entry.seq,
        detail: result.error ?? "no-effect",
      };
    }
    state = result.state;
    lastSeq = entry.seq;
    lastAt = entry.at;
    applied.push(entry);
  }

  if (applied.length > 0 && !isValidGameState(state)) {
    return { status: "rejected", reason: "invalid-result", seq: lastSeq };
  }
  return { status: "accepted", state, lastSeq, lastAt, applied, duplicates };
}
