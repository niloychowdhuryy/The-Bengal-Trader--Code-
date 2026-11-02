import { describe, expect, it } from "vitest";
import { applyCommand, type GameCommand, type RecordedCommand } from "./commands";
import { createNewGame, type GameState } from "./model";
import { MAX_CLOCK_AHEAD_MS, replayCommands, type ReplayAnchor } from "./replay";

const T0 = 1_800_000_000_000;

function anchor(gold = 2_000): ReplayAnchor {
  return {
    state: { ...createNewGame("Maya"), gold, highestGold: gold },
    lastSeq: 0,
    lastAt: T0,
  };
}

function entry(seq: number, command: GameCommand, at = T0 + seq * 1_000): RecordedCommand {
  return { seq, at, command };
}

const options = { receivedAt: T0 + 3_600_000 };
const buySalt: GameCommand = { type: "buyGood", good: "salt", quantity: 1 };

function goldAfter(state: GameState, ...commands: GameCommand[]): number {
  return commands.reduce((current, command) => applyCommand(current, command, T0).state, state).gold;
}

describe("replayCommands", () => {
  it("recalculates results from the commands themselves", () => {
    const start = anchor();
    const result = replayCommands(start, [entry(1, buySalt), entry(2, buySalt)], options);
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.state.gold).toBe(goldAfter(start.state, buySalt, buySalt));
    expect(result.state.gold).toBeLessThan(start.state.gold);
    expect(result).toMatchObject({ lastSeq: 2, lastAt: T0 + 2_000, duplicates: 0 });
    expect(result.applied).toHaveLength(2);
  });

  it("leaves the verified state untouched", () => {
    const start = anchor();
    const before = JSON.stringify(start.state);
    replayCommands(start, [entry(1, buySalt)], options);
    expect(JSON.stringify(start.state)).toBe(before);
  });

  it("offers no way to claim a result", () => {
    const forged = { ...entry(1, buySalt), gold: 1_000_000 };
    expect(replayCommands(anchor(), [forged], options)).toMatchObject({
      status: "rejected",
      reason: "malformed-command",
    });
  });

  it("rejects invalid economic actions", () => {
    const start = anchor(0);
    expect(replayCommands(start, [entry(1, buySalt)], options)).toMatchObject({
      status: "rejected",
      reason: "command-refused",
      seq: 1,
      detail: "gold",
    });
    expect(
      replayCommands(anchor(), [entry(1, { type: "sellGood", good: "opium", quantity: 1 })], options),
    ).toMatchObject({ reason: "command-refused", detail: "empty" });
  });

  it("is all or nothing: one bad command rejects the batch", () => {
    const result = replayCommands(
      anchor(),
      [entry(1, buySalt), entry(2, { type: "sellGood", good: "opium", quantity: 5 }), entry(3, buySalt)],
      options,
    );
    expect(result).toMatchObject({ status: "rejected", seq: 2 });
    expect(result).not.toHaveProperty("state");
  });

  it("rejects arriving early, even with a forged time inside the allowed window", () => {
    const start = anchor();
    const sailing = replayCommands(
      start,
      [entry(1, { type: "selectDestination", town: "patna" }), entry(2, { type: "startVoyage" })],
      options,
    );
    expect(sailing.status).toBe("accepted");
    if (sailing.status !== "accepted") return;
    const next = { state: sailing.state, lastSeq: 2, lastAt: sailing.lastAt };
    expect(
      replayCommands(next, [entry(3, { type: "arrive" }, sailing.lastAt + 1_000)], options),
    ).toMatchObject({ reason: "command-refused", detail: "voyage-not-finished" });
    // Claiming the future to finish the trip is refused too.
    const duration = sailing.state.voyage!.durationMs;
    expect(
      replayCommands(next, [entry(3, { type: "arrive" }, Math.ceil(sailing.lastAt + duration))], {
        receivedAt: sailing.lastAt + 1_000,
      }),
    ).toMatchObject({ reason: "invalid-time", seq: 3 });
  });

  it("can't pay a contract reward twice", () => {
    const state = anchor().state;
    const accept: GameCommand = { type: "acceptMission", missionId: "dhaka:visit" };
    const first = replayCommands({ ...anchor(), state }, [entry(1, accept)], options);
    expect(first.status).toBe("accepted");
    if (first.status !== "accepted") return;
    expect(
      replayCommands({ state: first.state, lastSeq: 1, lastAt: first.lastAt }, [entry(2, accept)], options),
    ).toMatchObject({ reason: "command-refused", detail: "not-available" });
  });

  describe("ordering", () => {
    it("rejects gaps", () => {
      expect(replayCommands(anchor(), [entry(2, buySalt)], options)).toMatchObject({
        reason: "sequence-gap",
        seq: 2,
      });
      expect(replayCommands(anchor(), [entry(1, buySalt), entry(3, buySalt)], options)).toMatchObject({
        reason: "sequence-gap",
        seq: 3,
      });
    });

    it("rejects out-of-order commands", () => {
      expect(replayCommands(anchor(), [entry(2, buySalt), entry(1, buySalt)], options)).toMatchObject({
        reason: "sequence-gap",
      });
    });

    it("rejects time going backward", () => {
      expect(
        replayCommands(anchor(), [entry(1, buySalt, T0 + 500), entry(2, buySalt, T0 + 100)], options),
      ).toMatchObject({ reason: "invalid-time", seq: 2 });
      expect(replayCommands(anchor(), [entry(1, buySalt, T0 - 1)], options)).toMatchObject({
        reason: "invalid-time",
        seq: 1,
      });
    });

    it("rejects commands from the future but tolerates small clock differences", () => {
      const receivedAt = T0 + 10_000;
      expect(
        replayCommands(anchor(), [entry(1, buySalt, receivedAt + MAX_CLOCK_AHEAD_MS)], { receivedAt }).status,
      ).toBe("accepted");
      expect(
        replayCommands(anchor(), [entry(1, buySalt, receivedAt + MAX_CLOCK_AHEAD_MS + 1)], { receivedAt }),
      ).toMatchObject({ reason: "invalid-time" });
    });
  });

  describe("duplicates", () => {
    function afterTwo() {
      const first = [entry(1, buySalt), entry(2, buySalt)];
      const result = replayCommands(anchor(), first, options);
      if (result.status !== "accepted") throw new Error("setup failed");
      return {
        first,
        next: { state: result.state, lastSeq: 2, lastAt: result.lastAt },
      };
    }

    it("ignores an honest retry without charging twice", () => {
      const { first, next } = afterTwo();
      const retry = replayCommands(next, first, { ...options, knownCommands: first });
      expect(retry).toMatchObject({ status: "accepted", duplicates: 2, lastSeq: 2 });
      if (retry.status !== "accepted") return;
      expect(retry.applied).toHaveLength(0);
      expect(retry.state.gold).toBe(next.state.gold);
    });

    it("applies only the new part of an overlapping batch", () => {
      const { first, next } = afterTwo();
      const retry = replayCommands(next, [...first, entry(3, buySalt)], { ...options, knownCommands: first });
      expect(retry).toMatchObject({ status: "accepted", duplicates: 2, lastSeq: 3 });
      if (retry.status !== "accepted") return;
      expect(retry.applied.map((command) => command.seq)).toEqual([3]);
    });

    it("refuses to rewrite history under an old number", () => {
      const { first, next } = afterTwo();
      const forged = entry(2, { type: "sellGood", good: "salt", quantity: 1 });
      expect(
        replayCommands(next, [forged], { ...options, knownCommands: first }),
      ).toMatchObject({ reason: "sequence-conflict", seq: 2 });
    });
  });

  it("rejects a result that breaks the save rules", () => {
    const broken = anchor();
    const tampered = { ...broken, state: { ...broken.state, cargo: { ...broken.state.cargo, rice: 999 } } };
    expect(
      replayCommands(tampered, [entry(1, { type: "selectDestination", town: "patna" })], options),
    ).toMatchObject({ reason: "invalid-result" });
  });
});
