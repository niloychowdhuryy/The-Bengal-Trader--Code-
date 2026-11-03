import { describe, expect, it } from "vitest";
import { applyCommand } from "./commands";
import {
  CONTRACT_REPEAT_DAYS,
  GOODS,
  MARKET_BASE_PRICES,
  acceptMission,
  advanceWorld,
  arriveAtDestination,
  buyGood,
  createMissionBoard,
  createNewGame,
  sellGood,
  startVoyage,
  syncSelectedShip,
  type GameState,
  type GoodId,
  type Mission,
} from "./model";
import { migrateLegacySave, validateSave } from "./save-format";

const NO_GOODS = Object.fromEntries(GOODS.map((good) => [good.id, 0])) as Record<GoodId, number>;
const T0 = 1_000_000;

function game(change: Partial<GameState> = {}): GameState {
  return syncSelectedShip({
    ...createNewGame("Maya", 8),
    cargo: { ...NO_GOODS },
    averagePurchasePrice: { ...NO_GOODS },
    coins: 100_000,
    highestCoins: 100_000,
    ...change,
  });
}

const mission = (state: GameState, id: string): Mission => state.missions.find((entry) => entry.id === id)!;

/** Sails to a port, however long that takes, with the world keeping up. */
function sailTo(state: GameState, town: GameState["currentTown"]): GameState {
  const leaving = startVoyage({ ...state, selectedTown: town }, T0);
  expect(leaving.voyage).not.toBeNull();
  const arrived = arriveAtDestination(leaving);
  return { ...arrived, encounterPending: false };
}

/** Lets the days pass while docked, as long voyages elsewhere would. */
function daysPass(state: GameState, days: number): GameState {
  const until = state.sailingDay + days;
  return advanceWorld({ ...state, sailingDay: until }, until);
}

function finishVisit(state: GameState, id: string): GameState {
  const offer = mission(state, id);
  const home = state.currentTown === offer.origin ? state : sailTo(state, offer.origin);
  const accepted = acceptMission(home, id);
  expect(accepted.error).toBeUndefined();
  return sailTo(accepted.state, offer.destination);
}

describe("contract rewards", () => {
  it("pay 130% of the goods' reference value for both kinds of delivery", () => {
    for (const offer of createMissionBoard()) {
      if (offer.type !== "delivery" && offer.type !== "purchase_delivery") continue;
      const worth = offer.quantity * MARKET_BASE_PRICES[offer.good!] * 1.3;
      expect(Math.abs(offer.rewardCoins - worth)).toBeLessThanOrEqual(2.5);
      expect(offer.rewardCoins % 5).toBe(0);
    }
  });

  it("pay 500 Coins for a visit, and leave profit targets as they were", () => {
    for (const offer of createMissionBoard()) {
      if (offer.type === "visit") expect(offer.rewardCoins).toBe(500);
      if (offer.type === "profitable_trade") expect(offer.rewardCoins).toBe(1_100);
    }
  });
});

describe("repeating a contract", () => {
  const VISIT = "dhaka:visit";

  it("waits 40 days after a success, then offers it clean", () => {
    const done = finishVisit(game(), VISIT);
    const finished = mission(done, VISIT);
    expect(finished.status).toBe("completed");
    expect(finished.availableAgainDay).toBe(done.worldDay + CONTRACT_REPEAT_DAYS);

    const almost = daysPass(done, finished.availableAgainDay! - done.worldDay - 1);
    expect(mission(almost, VISIT).status).toBe("completed");

    const again = daysPass(almost, 1);
    expect(mission(again, VISIT)).toMatchObject({
      status: "available",
      progress: 0,
      purchasedQuantity: 0,
      acceptedAtSailingDay: null,
      deadlineSailingDay: null,
      availableAgainDay: null,
      reputationEarned: true,
    });
  });

  it("can't be taken again while it's waiting", () => {
    const done = finishVisit(game(), VISIT);
    const home = sailTo(done, "dhaka");
    expect(acceptMission(home, VISIT).error).toBe("not-available");
  });

  it("pays Coins every time, but reputation and standing only the first", () => {
    const start = game();
    const first = finishVisit(start, VISIT);
    const rewardedReputation = first.reputation;
    const rewardedStanding = first.localStanding.dhaka;
    expect(first.coins).toBe(start.coins + 500);
    expect(rewardedStanding).toBe(5);
    expect(first.lastMessage).toContain("+2 reputation");

    const second = finishVisit(daysPass(first, CONTRACT_REPEAT_DAYS), VISIT);
    expect(mission(second, VISIT).status).toBe("completed");
    expect(second.coins).toBe(first.coins + 500);
    expect(second.localStanding.dhaka).toBe(rewardedStanding);
    expect(second.lastMessage).toContain("Contract complete: 500 Coins.");
    // New ports along the way give reputation of their own, so only compare from here on.
    const third = finishVisit(daysPass(second, CONTRACT_REPEAT_DAYS), VISIT);
    expect(third.reputation).toBe(second.reputation);
    expect(third.coins).toBe(second.coins + 500);
    expect(rewardedReputation).toBeGreaterThanOrEqual(2);
  });

  it("gives a contract's first success its reputation even if an earlier try expired", () => {
    const accepted = acceptMission(game(), VISIT).state;
    const late = { ...accepted, sailingDay: 40, worldDay: 40 };
    const destination = mission(late, VISIT).destination;
    const arrived = sailTo(late, destination);
    expect(mission(arrived, VISIT)).toMatchObject({ status: "expired", reputationEarned: false });
    expect(arrived.coins).toBe(late.coins);

    const reopened = daysPass(arrived, CONTRACT_REPEAT_DAYS);
    expect(mission(reopened, VISIT).status).toBe("available");
    const standingBefore = reopened.localStanding.dhaka;
    const done = finishVisit(reopened, VISIT);
    expect(done.localStanding.dhaka).toBe(standingBefore + 5);
    expect(mission(done, VISIT).reputationEarned).toBe(true);
  });

  it("can't earn reputation twice by letting a finished contract expire and taking it again", () => {
    const done = finishVisit(game(), VISIT);
    const reopened = daysPass(done, CONTRACT_REPEAT_DAYS);
    const home = sailTo(reopened, "dhaka");
    const taken = acceptMission(home, VISIT).state;
    const late = { ...taken, sailingDay: taken.sailingDay + 40, worldDay: taken.worldDay + 40 };
    const destination = mission(late, VISIT).destination;
    const expired = sailTo(late, destination);
    expect(mission(expired, VISIT)).toMatchObject({ status: "expired", reputationEarned: true });

    const again = finishVisit(daysPass(expired, CONTRACT_REPEAT_DAYS), VISIT);
    expect(again.reputation).toBe(expired.reputation);
    expect(again.localStanding.dhaka).toBe(expired.localStanding.dhaka);
    expect(again.coins).toBe(expired.coins + 500);
  });

  it("keeps the limit of two contracts at a time", () => {
    const state = game();
    const one = acceptMission(state, "dhaka:visit").state;
    const two = acceptMission(one, "dhaka:delivery").state;
    expect(acceptMission(two, "dhaka:purchase-delivery").error).toBe("active-limit");
  });

  it("replays exactly through commands", () => {
    const start = game();
    const accepted = applyCommand(start, { type: "acceptMission", missionId: VISIT }, T0);
    expect(accepted.status).toBe("applied");
    expect(mission(accepted.state, VISIT).reputationEarned).toBe(false);
  });
});

describe("what goes into a delivery", () => {
  it("takes goods the player already owned, at what they cost", () => {
    const offer = mission(game(), "dhaka:delivery");
    const good = offer.good!;
    const owned = game({
      cargo: { ...NO_GOODS, [good]: 3 },
      averagePurchasePrice: { ...NO_GOODS, [good]: 700 },
    });
    const accepted = acceptMission(owned, offer.id).state;
    const coinsBefore = accepted.coins;
    const arrived = sailTo(accepted, offer.destination);
    expect(mission(arrived, offer.id).status).toBe("completed");
    expect(arrived.cargo[good]).toBe(1);
    expect(arrived.averagePurchasePrice[good]).toBe(700);
    expect(arrived.coins).toBe(coinsBefore + offer.rewardCoins);
  });

  it("isn't paid until enough goods have been handed over", () => {
    const offer = mission(game(), "dhaka:delivery");
    const good = offer.good!;
    const short = game({
      cargo: { ...NO_GOODS, [good]: 1 },
      averagePurchasePrice: { ...NO_GOODS, [good]: 700 },
    });
    const accepted = acceptMission(short, offer.id).state;
    const arrived = sailTo(accepted, offer.destination);
    expect(mission(arrived, offer.id)).toMatchObject({ status: "active", progress: 1 });
    expect(arrived.coins).toBe(accepted.coins);
    expect(arrived.cargo[good]).toBe(0);
  });

  it("won't count goods already owned towards a buy-and-deliver contract", () => {
    const offer = mission(game(), "dhaka:purchase-delivery");
    const good = offer.good!;
    const owned = game({
      cargo: { ...NO_GOODS, [good]: offer.quantity },
      averagePurchasePrice: { ...NO_GOODS, [good]: 700 },
    });
    const accepted = acceptMission(owned, offer.id).state;
    const arrived = sailTo(accepted, offer.destination);
    expect(mission(arrived, offer.id).status).toBe("active");
    expect(arrived.cargo[good]).toBe(offer.quantity);
  });

  it("completes a buy-and-deliver contract once bought at its port, charging what was paid", () => {
    const offer = mission(game(), "dhaka:purchase-delivery");
    const good = offer.good!;
    const accepted = acceptMission(game(), offer.id).state;
    const bought = buyGood(accepted, good, offer.quantity).state;
    const paid = accepted.coins - bought.coins;
    expect(mission(bought, offer.id).purchasedQuantity).toBe(offer.quantity);
    const arrived = sailTo(bought, offer.destination);
    expect(mission(arrived, offer.id).status).toBe("completed");
    expect(arrived.coins).toBe(accepted.coins - paid + offer.rewardCoins);
  });

  it("makes the same purchase count again on a repeat only if it's bought again", () => {
    const offer = mission(game(), "dhaka:purchase-delivery");
    const good = offer.good!;
    const accepted = acceptMission(game(), offer.id).state;
    const bought = buyGood(accepted, good, offer.quantity).state;
    const done = sailTo(bought, offer.destination);
    const reopened = daysPass(done, CONTRACT_REPEAT_DAYS);
    expect(mission(reopened, offer.id).purchasedQuantity).toBe(0);
  });

  it("still counts a profit target's progress from real sales", () => {
    const offer = mission(game(), "dhaka:profitable-trade");
    const good = offer.good!;
    const accepted = acceptMission(game({ cargo: { ...NO_GOODS, [good]: 12 } }), offer.id).state;
    const sold = sellGood(accepted, good, 12).state;
    expect(mission(sold, offer.id).progress).toBeGreaterThan(0);
  });
});

describe("contracts in saves", () => {
  const VISIT = "dhaka:visit";

  it("keep their wait and their first-success record through a reload", () => {
    const done = finishVisit(game(), VISIT);
    const reloaded = validateSave(JSON.parse(JSON.stringify(done)));
    expect(mission(reloaded, VISIT)).toEqual(mission(done, VISIT));
    const reopened = daysPass(reloaded, CONTRACT_REPEAT_DAYS);
    expect(mission(reopened, VISIT)).toMatchObject({ status: "available", reputationEarned: true });
    expect(mission(validateSave(JSON.parse(JSON.stringify(reopened))), VISIT).reputationEarned).toBe(true);
  });

  it("don't reopen from time passing while the game is closed", () => {
    const done = finishVisit(game(), VISIT);
    const later = validateSave(JSON.parse(JSON.stringify(done)), Date.now() + 1_000 * 60 * 60 * 24 * 365);
    expect(mission(later, VISIT).status).toBe("completed");
    expect(later.worldDay).toBe(done.worldDay);
  });

  it("upgrade from version 26 with rewards updated and past successes remembered", () => {
    const base = createNewGame("Maya", 8);
    const accepted = acceptMission(base, "dhaka:delivery").state;
    const old = {
      ...accepted,
      version: 26,
      worldDay: 50,
      sailingDay: 50,
      missions: accepted.missions.map((entry) => {
        const { reputationEarned: _earned, availableAgainDay: _day, ...rest } = entry;
        if (entry.id === "dhaka:visit") {
          return { ...rest, rewardCoins: 900, status: "completed", acceptedAtSailingDay: 10, deadlineSailingDay: 40, progress: 1 };
        }
        if (entry.id === "hooghly:visit") {
          return { ...rest, rewardCoins: 900, status: "expired", acceptedAtSailingDay: 10, deadlineSailingDay: 40 };
        }
        if (entry.id === "dhaka:delivery") {
          return { ...rest, rewardCoins: 1_200, acceptedAtSailingDay: 45, deadlineSailingDay: 69 };
        }
        return entry.type === "visit" ? { ...rest, rewardCoins: 900 } : rest;
      }),
    };
    const migrated = validateSave(migrateLegacySave(old));
    expect(migrated.version).toBe(27);
    expect(mission(migrated, "dhaka:visit")).toMatchObject({
      status: "completed",
      rewardCoins: 500,
      reputationEarned: true,
      availableAgainDay: 90,
    });
    expect(mission(migrated, "hooghly:visit")).toMatchObject({
      status: "expired",
      reputationEarned: false,
      availableAgainDay: 90,
    });
    expect(mission(migrated, "dhaka:delivery")).toMatchObject({
      status: "active",
      reputationEarned: false,
      availableAgainDay: null,
    });
    expect(mission(migrated, "dhaka:delivery").rewardCoins).toBe(createMissionBoard().find((entry) => entry.id === "dhaka:delivery")!.rewardCoins);
  });

  it.each([
    ["a success with no reputation record", { status: "completed", reputationEarned: false, availableAgainDay: 50, acceptedAtSailingDay: 0, deadlineSailingDay: 30, progress: 1 }],
    ["an offer with a waiting day", { availableAgainDay: 50 }],
    ["a finished contract with no waiting day", { status: "completed", reputationEarned: true, availableAgainDay: null, acceptedAtSailingDay: 0, deadlineSailingDay: 30, progress: 1 }],
    ["a record that isn't true or false", { reputationEarned: "yes" }],
    ["a changed reward", { rewardCoins: 900 }],
  ])("refuse %s", (_label, change) => {
    const base = createNewGame("Maya", 8);
    const bad = {
      ...base,
      missions: base.missions.map((entry) => (entry.id === VISIT ? { ...entry, ...change } : entry)),
    };
    expect(() => validateSave(bad)).toThrow();
  });
});
