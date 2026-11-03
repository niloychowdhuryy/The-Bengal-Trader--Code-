// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { RecordedCommand } from "../game/commands";
import { createNewGame } from "../game/model";
import { createSupabaseSyncStore, type SupabaseLike } from "./supabase-store";
import { handleSync, MAX_BATCH_COMMANDS, type SyncStore } from "./sync";

const T0 = 1_800_000_000_000;
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

let db: PGlite;
let store: SyncStore;

// Just enough of the Supabase client to run the real store against real SQL.
function testClient(database: PGlite): SupabaseLike {
  return {
    from(table: string) {
      const filters: { sql: string; value: unknown }[] = [];
      let columns = "*";
      const run = async (single: boolean) => {
        const where = filters.length
          ? `where ${filters.map((filter, index) => `${filter.sql} $${index + 1}`).join(" and ")}`
          : "";
        const result = await database.query(
          `select ${columns} from public.${table} ${where}`,
          filters.map((filter) => filter.value),
        );
        return { data: single ? (result.rows[0] ?? null) : result.rows, error: null };
      };
      const builder = {
        select(value: string) { columns = value; return builder; },
        eq(column: string, value: unknown) { filters.push({ sql: `${column} =`, value }); return builder; },
        lte(column: string, value: unknown) { filters.push({ sql: `${column} <=`, value }); return builder; },
        gte(column: string, value: unknown) { filters.push({ sql: `${column} >=`, value }); return builder; },
        maybeSingle: () => run(true),
        then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) =>
          run(false).then(resolve, reject),
      };
      return builder;
    },
    rpc(name, args) {
      const keys = Object.keys(args);
      const casts: Record<string, string> = {
        p_player_id: "uuid", p_expected_revision: "bigint", p_state: "jsonb", p_schema_version: "integer",
        p_last_seq: "bigint", p_last_at: "bigint", p_batch_id: "uuid", p_first_seq: "bigint", p_commands: "jsonb",
      };
      const placeholders = keys.map((key, index) => `${key} => $${index + 1}::${casts[key]}`);
      return database
        .query<{ ok: boolean }>(
          `select public.${name}(${placeholders.join(", ")}) as ok`,
          keys.map((key) => (casts[key] === "jsonb" ? JSON.stringify(args[key]) : args[key])),
        )
        .then((result) => ({ data: result.rows[0].ok, error: null }));
    },
  };
}

async function seedPlayer(id: string, coins = 100_000) {
  await db.query("insert into auth.users (id) values ($1)", [id]);
  await db.query(
    `insert into public.game_states (player_id, state, schema_version, last_at, provenance)
     values ($1, $2::jsonb, 19, $3, 'verified')`,
    [id, JSON.stringify({ ...createNewGame("Maya"), coins, highestCoins: coins }), T0],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(
    readFileSync("supabase/migrations/20261102000000_foundation.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261102000100_profiles.sql", "utf8"),
  );
  await db.exec(`grant all on all tables in schema public to service_role;`);
  store = createSupabaseSyncStore(testClient(db));
}, 60_000);

beforeEach(async () => {
  await db.exec("reset role; truncate auth.users cascade;");
  await seedPlayer(ALICE);
  await seedPlayer(BOB);
});

const buy = (seq: number, at = T0 + seq * 1_000): RecordedCommand => ({
  seq,
  at,
  command: { type: "buyGood", good: "salt", quantity: 1 },
});

const send = (commands: unknown[], baseRevision = 0, batch = 1, player = ALICE) =>
  handleSync(store, player, { batchId: uuid(batch), baseRevision, commands }, T0 + 3_600_000);

async function row(player = ALICE) {
  const result = await db.query<{ state: { coins: number }; revision: string; last_seq: string; last_at: string }>(
    "select state, revision, last_seq, last_at from public.game_states where player_id = $1",
    [player],
  );
  return result.rows[0];
}

describe("handleSync with the real database", () => {
  it("verifies a batch and stores the server's own result", async () => {
    const result = await send([buy(1), buy(2)]);
    expect(result).toMatchObject({ status: "accepted", revision: 1, lastSeq: 2 });
    const saved = await row();
    expect(saved.state.coins).toBeLessThan(100_000);
    expect(Number(saved.revision)).toBe(1);
    expect(Number(saved.last_seq)).toBe(2);
    expect(Number(saved.last_at)).toBe(T0 + 2_000);
    const batches = await db.query("select * from public.command_batches");
    expect(batches.rows).toHaveLength(1);
  });

  it("stores nothing when a batch is rejected", async () => {
    const result = await send([buy(1), { seq: 2, at: T0 + 2_000, command: { type: "sellGood", good: "opium", quantity: 9 } }]);
    expect(result).toMatchObject({ status: "rejected", reason: "command-refused", seq: 2 });
    expect(Number((await row()).revision)).toBe(0);
    expect((await row()).state.coins).toBe(100_000);
  });

  it("handles the same batch arriving twice without charging twice", async () => {
    await send([buy(1)]);
    const coins = (await row()).state.coins;
    const again = await send([buy(1)]);
    expect(again).toEqual({ status: "already-applied", revision: 1, lastSeq: 1 });
    expect((await row()).state.coins).toBe(coins);
  });

  it("handles a retry under a new batch id, and only applies what's new", async () => {
    await send([buy(1), buy(2)]);
    const coinsAfterTwo = (await row()).state.coins;
    expect(await send([buy(1), buy(2)], 1, 2)).toMatchObject({ status: "already-applied" });
    expect((await row()).state.coins).toBe(coinsAfterTwo);
    const result = await send([buy(2), buy(3)], 1, 3);
    expect(result).toMatchObject({ status: "accepted", lastSeq: 3, revision: 2 });
    expect((await row()).state.coins).toBeLessThan(coinsAfterTwo);
  });

  it("refuses to rewrite a command already verified", async () => {
    await send([buy(1)]);
    const forged = { seq: 1, at: T0 + 1_000, command: { type: "sellGood", good: "salt", quantity: 1 } };
    expect(await send([forged], 1, 2)).toMatchObject({ status: "rejected", reason: "sequence-conflict" });
  });

  it("reports a conflict rather than overwriting newer progress", async () => {
    await send([buy(1)]);
    const stale = await send([buy(1, T0 + 5_000)], 0, 2);
    expect(stale).toEqual({ status: "conflict", revision: 1, lastSeq: 1 });
    expect(Number((await row()).revision)).toBe(1);
  });

  it("lets only one of two simultaneous saves win", async () => {
    const update = {
      state: createNewGame("Maya"), revision: 1, lastSeq: 1, lastAt: T0 + 1,
      expectedRevision: 0, firstSeq: 1, commands: [buy(1)],
    };
    expect(await store.commit(ALICE, { ...update, batchId: uuid(1) })).toBe(true);
    expect(await store.commit(ALICE, { ...update, batchId: uuid(2) })).toBe(false);
  });

  it("keeps players separate", async () => {
    await send([buy(1)]);
    expect((await row(BOB)).state.coins).toBe(100_000);
    expect(await send([buy(1)], 0, 2, BOB)).toMatchObject({ status: "accepted", revision: 1 });
  });

  it.each([
    [null],
    [{}],
    [{ batchId: "not-a-uuid", baseRevision: 0, commands: [buy(1)] }],
    [{ batchId: uuid(1), baseRevision: "0", commands: [buy(1)] }],
    [{ batchId: uuid(1), baseRevision: 0, commands: [] }],
    [{ batchId: uuid(1), baseRevision: 0, commands: new Array(MAX_BATCH_COMMANDS + 1).fill(0) }],
  ])("rejects malformed requests (%#)", async (body) => {
    expect(await handleSync(store, ALICE, body, T0)).toEqual({ status: "invalid-request" });
  });

  it("reports a player with no game yet", async () => {
    await db.query("delete from public.game_states where player_id = $1", [ALICE]);
    expect(await send([buy(1)])).toEqual({ status: "no-game" });
  });
});

describe("database access rules", () => {
  async function as(role: "anon" | "authenticated", player: string | null, sql: string) {
    await db.exec(`set role ${role}; select set_config('request.jwt.sub', '${player ?? ""}', false);`);
    try {
      return await db.query(sql);
    } finally {
      await db.exec("reset role;");
    }
  }
  const coins = `state = '{"coins": 999999}'::jsonb`;

  it("lets players read only their own game", async () => {
    const rows = await as("authenticated", ALICE, "select player_id from public.game_states");
    expect(rows.rows).toEqual([{ player_id: ALICE }]);
    const profiles = await as("authenticated", BOB, "select id from public.profiles");
    expect(profiles.rows).toEqual([{ id: BOB }]);
  });

  it.each([
    ["editing their save", `update public.game_states set ${coins}`],
    ["creating a save", `insert into public.game_states (player_id, state, schema_version, provenance) values ('${ALICE}', '{}', 19, 'verified')`],
    ["deleting their save", "delete from public.game_states"],
    ["editing their profile directly", "update public.profiles set display_name = 'Hacker'"],
    ["creating a backup", `insert into public.save_backups (player_id, state, revision, reason) values ('${ALICE}', '{}', 0, 'x')`],
    ["reading command history", "select * from public.command_batches"],
    ["writing command history", `insert into public.command_batches (player_id, batch_id, first_seq, last_seq, revision, commands) values ('${ALICE}', '${uuid(9)}', 1, 1, 1, '[]')`],
    ["calling the save function", `select public.commit_sync('${ALICE}', 0, '{"coins": 999999}', 19, 1, 1, '${uuid(9)}', 1, '[]')`],
  ])("stops a signed-in player %s", async (_name, sql) => {
    await expect(as("authenticated", ALICE, sql)).rejects.toThrow(/permission denied/);
    expect((await row()).state.coins).toBe(100_000);
  });

  it.each([
    ["reading games", "select * from public.game_states"],
    ["reading profiles", "select * from public.profiles"],
    ["calling the save function", `select public.commit_sync('${ALICE}', 0, '{}', 19, 1, 1, '${uuid(9)}', 1, '[]')`],
  ])("stops anonymous visitors %s", async (_name, sql) => {
    await expect(as("anon", null, sql)).rejects.toThrow(/permission denied/);
  });

  describe("profiles", () => {
    const setProfile = (player: string | null, name: string, age = true) =>
      as(player ? "authenticated" : "anon", player, `select public.complete_profile('${name}', ${age})`);
    const profile = async (player: string) =>
      (await db.query<{ display_name: string | null; age_confirmed_at: string | null }>(
        "select display_name, age_confirmed_at from public.profiles where id = $1",
        [player],
      )).rows[0];

    it("creates an empty profile for each new account, with no Google details", async () => {
      expect(await profile(ALICE)).toEqual({ display_name: null, age_confirmed_at: null });
    });

    it("lets a player set their own name and confirm their age", async () => {
      await setProfile(ALICE, "Rani of Dhaka");
      const saved = await profile(ALICE);
      expect(saved.display_name).toBe("Rani of Dhaka");
      expect(saved.age_confirmed_at).not.toBeNull();
      expect((await profile(BOB)).display_name).toBeNull();
    });

    it("trims the name and keeps the first age confirmation", async () => {
      await setProfile(ALICE, "  Rani  ");
      const first = await profile(ALICE);
      expect(first.display_name).toBe("Rani");
      await setProfile(ALICE, "Rani Two");
      expect((await profile(ALICE)).age_confirmed_at).toEqual(first.age_confirmed_at);
    });

    it("refuses without age confirmation", async () => {
      await expect(setProfile(ALICE, "Rani", false)).rejects.toThrow(/age-required/);
      expect((await profile(ALICE)).display_name).toBeNull();
    });

    it.each(["", "a", "x".repeat(25), "<script>", "Rani!", " ", "-Rani", "Rani-"])(
      "refuses the name %j",
      async (name) => {
        await expect(setProfile(ALICE, name)).rejects.toThrow(/name-invalid/);
      },
    );

    it("refuses a name someone else has, ignoring capitals", async () => {
      await setProfile(ALICE, "Rani");
      await expect(setProfile(BOB, "RANI")).rejects.toThrow(/name-taken/);
    });

    it("stops anonymous visitors using it", async () => {
      await expect(setProfile(null, "Rani")).rejects.toThrow(/permission denied/);
    });

    it("doesn't let players run the account trigger function", async () => {
      await expect(
        as("authenticated", ALICE, "select public.handle_new_user()"),
      ).rejects.toThrow(/permission denied|trigger/);
    });

    it("hides other players' profiles", async () => {
      await setProfile(BOB, "Bob");
      const rows = await as("authenticated", ALICE, "select display_name from public.profiles");
      expect(rows.rows).toEqual([{ display_name: null }]);
    });
  });

  it("removes all of a player's data when their account is deleted", async () => {
    await send([buy(1)]);
    await db.query("delete from auth.users where id = $1", [ALICE]);
    expect(await row()).toBeUndefined();
    const left = await db.query("select * from public.command_batches where player_id = $1", [ALICE]);
    expect(left.rows).toEqual([]);
  });
});
