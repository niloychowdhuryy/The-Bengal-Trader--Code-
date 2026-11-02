import type { RecordedCommand } from "../game/commands";
import type { SyncStore } from "./sync";

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** The small part of the Supabase client this store needs. */
export interface SupabaseLike {
  from(table: string): any;
  rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResult<boolean>>;
}

function unwrap<T>(result: QueryResult<T>): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function createSupabaseSyncStore(client: SupabaseLike): SyncStore {
  return {
    async loadGame(playerId) {
      const row = unwrap<{ state: never; revision: number; last_seq: number; last_at: number }>(
        await client
          .from("game_states")
          .select("state, revision, last_seq, last_at")
          .eq("player_id", playerId)
          .maybeSingle(),
      );
      return row
        ? {
            state: row.state,
            revision: Number(row.revision),
            lastSeq: Number(row.last_seq),
            lastAt: Number(row.last_at),
          }
        : null;
    },
    async findBatch(playerId, batchId) {
      const row = unwrap<{ revision: number; last_seq: number }>(
        await client
          .from("command_batches")
          .select("revision, last_seq")
          .eq("player_id", playerId)
          .eq("batch_id", batchId)
          .maybeSingle(),
      );
      return row ? { revision: Number(row.revision), lastSeq: Number(row.last_seq) } : null;
    },
    async loadCommands(playerId, fromSeq, toSeq) {
      const rows = unwrap<{ commands: RecordedCommand[] }[]>(
        await client
          .from("command_batches")
          .select("commands")
          .eq("player_id", playerId)
          .lte("first_seq", toSeq)
          .gte("last_seq", fromSeq),
      );
      return (rows ?? [])
        .flatMap((row) => row.commands)
        .filter((entry) => entry.seq >= fromSeq && entry.seq <= toSeq);
    },
    async commit(playerId, update) {
      const saved = unwrap(
        await client.rpc("commit_sync", {
          p_player_id: playerId,
          p_expected_revision: update.expectedRevision,
          p_state: update.state,
          p_schema_version: update.state.version,
          p_last_seq: update.lastSeq,
          p_last_at: update.lastAt,
          p_batch_id: update.batchId,
          p_first_seq: update.firstSeq,
          p_commands: update.commands,
        }),
      );
      return saved === true;
    },
  };
}
