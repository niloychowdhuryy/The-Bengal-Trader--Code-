// How rival merchants judge a trade. Their starting purses and routes are in npc-roster.ts.
import type { VesselClassId } from "../model";
import type { MerchantTemperament } from "../npc-roster";

export interface TemperamentRules {
  /** The first unit must clear this margin, as a share of its price, or the route isn't worth it. */
  minMargin: number;
  /** Once a route is worth it, keep loading while the next unit still earns this much. */
  loadMargin: number;
  /** Share of the purse kept back from any one cargo. */
  reserve: number;
  /** Share of expected profit discounted for each day at sea. */
  riskPerDay: number;
  /** How far a merchant's idea of a distant price can be wrong. */
  priceError: number;
  /** Days spent in port after arriving. */
  dockDays: number;
  maxTripDays: number;
}

export const TEMPERAMENTS: Record<MerchantTemperament, TemperamentRules> = {
  cautious: { minMargin: 0.24, loadMargin: 0.16, reserve: 0.3, riskPerDay: 0.06, priceError: 0.04, dockDays: 2, maxTripDays: 3 },
  steady: { minMargin: 0.2, loadMargin: 0.14, reserve: 0.15, riskPerDay: 0.03, priceError: 0.07, dockDays: 1, maxTripDays: 4 },
  bold: { minMargin: 0.16, loadMargin: 0.11, reserve: 0.05, riskPerDay: 0.01, priceError: 0.12, dockDays: 1, maxTripDays: 6 },
};

// A voyage's costs spread over more units in a big hold, so bulk carriers can profitably take
// thinner margins on each one. It's the commercial case for a larger ship.
export const LOAD_MARGIN_BY_SHIP: Record<VesselClassId, number> = { bora: 1.1, "river-boat": 1, patello: 0.5 };

// Merchants leave a town at least this share of a stall's usual stock, and won't flood it
// beyond this share. So no rival can empty a stall, however large the ship.
export const STALL_FLOOR_SHARE = 0.4;
export const STALL_CEILING_SHARE = 1.6;
// Each unit moves a typical price about 1.1% at the stall it leaves and 1% where it lands.
export const MARGIN_LOST_PER_UNIT = 0.021;
// Working capital a merchant wants to keep after buying a ship: enough to fill a good part of
// the new hold, and ten days of crew.
export const WORKING_CAPITAL_PER_HOLD_UNIT = 350;
export const CREW_DAYS_KEPT = 10;
export const INVESTMENT_PAYBACK_DAYS = 250;
export const CAUTIOUS_PURSE_MULTIPLE = 3;
export const EMPTY_TRIP_CHANCE = 0.15;
export const ACTIVITY_PER_PORT = 4;
export const MAX_REPUTATION = 200;
export const STANDING_NAMES = ["Struggling", "Small trader", "Modest merchant", "Established merchant", "Great house"];
/** Worth needed for each standing after the first. */
export const STANDING_WORTH = [12_000, 25_000, 60_000, 150_000];

// A merchant who hasn't made a deal in a while takes thinner margins.
export const SHORT_IDLE_DAYS = 12;
export const SHORT_IDLE_MARGIN = 0.7;
export const LONG_IDLE_DAYS = 25;
export const LONG_IDLE_MARGIN = 0.4;
/** Below this share of what it started with, a merchant sells at any price and sails short trips. */
export const POOR_WORTH_SHARE = 0.5;
// The lowest price a merchant accepts for cargo, which falls the longer it's held.
export const FRESH_CARGO_MARGIN_SHARE = 1 / 3;
export const NEAR_COST_AFTER_DAYS = 5;
export const NEAR_COST_SHARE = 0.95;
export const ANY_PRICE_AFTER_DAYS = 10;
// How much more a merchant likes a port it favours, or a shipyard when it wants a new ship.
export const PREFERRED_PORT_BONUS = 1.2;
export const SHIPYARD_WANTED_BONUS = 1.5;
