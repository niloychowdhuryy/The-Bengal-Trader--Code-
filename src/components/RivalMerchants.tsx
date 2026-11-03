import { useState } from "react";
import {
  GOODS,
  VESSEL_CLASSES,
  formatCoins,
  getMerchantProfile,
  getMerchantStanding,
  getTown,
  isLaidUp,
  type GameState,
  type GoodId,
  type NpcMerchant,
} from "../game/model";

const TEMPERAMENT_LABELS = {
  cautious: "Cautious: waits for a clear profit",
  steady: "Steady: takes fair margins",
  bold: "Bold: takes risks and long trips",
};

function goodName(good: GoodId): string {
  return GOODS.find((item) => item.id === good)?.name ?? good;
}

function whereabouts(merchant: NpcMerchant): string {
  if (merchant.phase === "traveling") {
    const days = merchant.travelDaysRemaining;
    return `Sailing from ${getTown(merchant.currentPort).name} to ${getTown(merchant.destinationPort).name} · ${days} day${days === 1 ? "" : "s"} left`;
  }
  return `${isLaidUp(merchant) ? "Laid up" : "In port"} at ${getTown(merchant.currentPort).name}`;
}

function cargoSummary(merchant: NpcMerchant): string {
  const carried = GOODS.filter((good) => merchant.cargo[good.id] > 0).map(
    (good) => `${good.name} × ${merchant.cargo[good.id]}`,
  );
  return carried.length ? carried.join(", ") : "Nothing right now";
}

function RivalDetails({ state, merchant }: { state: GameState; merchant: NpcMerchant }) {
  const profile = getMerchantProfile(merchant.id);
  const recent = state.npcActivity
    .filter((activity) => activity.merchantId === merchant.id)
    .slice(-3)
    .reverse();
  return (
    <div className="rival-details">
      {profile && <p>{profile.description}</p>}
      {profile && <p>{TEMPERAMENT_LABELS[profile.temperament]}</p>}
      <dl>
        <div><dt>Ship</dt><dd>{VESSEL_CLASSES[merchant.vesselClass].name}, hold {merchant.cargoCapacity}</dd></div>
        <div><dt>Carrying</dt><dd>{cargoSummary(merchant)}</dd></div>
        <div><dt>Deals in</dt><dd>{merchant.preferences.map(goodName).join(", ")}</dd></div>
        <div><dt>Purse</dt><dd>{formatCoins(merchant.budget)} Coins</dd></div>
        <div><dt>Reputation</dt><dd>{merchant.reputation}</dd></div>
        <div><dt>Voyages</dt><dd>{merchant.tripsCompleted}</dd></div>
      </dl>
      {recent.length > 0 && (
        <ul aria-label={`Recent activity of ${merchant.name}`}>
          {recent.map((activity) => (
            <li key={activity.id}>
              Day {activity.sailingDay}, {getTown(activity.town).name}: {activity.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Slides up over the map when a merchant's ship is tapped. */
export function RivalShipPanel({
  state,
  merchantId,
  onClose,
}: {
  state: GameState;
  merchantId: string;
  onClose: () => void;
}) {
  const merchant = state.npcMerchants.find((entry) => entry.id === merchantId);
  if (!merchant) return null;
  return (
    <section className="rival-ship-panel" aria-label={`Merchant ${merchant.name}`}>
      <header>
        <div>
          <span className="eyebrow">{getMerchantStanding(merchant)}</span>
          <h2>{merchant.name}</h2>
          <p>{whereabouts(merchant)}</p>
        </div>
        <button className="drawer-close" aria-label="Close merchant details" onClick={onClose}>×</button>
      </header>
      <RivalDetails state={state} merchant={merchant} />
    </section>
  );
}

/** The ships at one dock are too close for a finger, so a tap lists them. */
export function RivalDockPanel({
  state,
  town,
  onSelect,
  onClose,
}: {
  state: GameState;
  town: GameState["currentTown"];
  onSelect: (merchantId: string) => void;
  onClose: () => void;
}) {
  const docked = state.npcMerchants.filter(
    (merchant) => merchant.phase === "docked" && merchant.currentPort === town,
  );
  return (
    <section className="rival-ship-panel" aria-label={`Merchants in port at ${getTown(town).name}`}>
      <header>
        <div>
          <span className="eyebrow">IN PORT</span>
          <h2>{getTown(town).name}</h2>
          <p>{docked.length} merchant{docked.length === 1 ? "" : "s"} at the docks</p>
        </div>
        <button className="drawer-close" aria-label="Close merchant list" onClick={onClose}>×</button>
      </header>
      <div className="rival-dock-list">
        {docked.map((merchant) => (
          <button key={merchant.id} onClick={() => onSelect(merchant.id)}>
            <strong>{merchant.name}</strong>
            <span>{getMerchantStanding(merchant)} · {VESSEL_CLASSES[merchant.vesselClass].name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Every merchant in the world, in alphabetical order. Rankings belong to the leaderboards. */
export function RivalList({ state }: { state: GameState }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const merchants = [...state.npcMerchants].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section className="rival-list" aria-label="Rival merchants">
      <p>
        These merchants trade by the same rules you do. Their cargo comes from the same stalls,
        and their sales move the same prices. All are fictional.
      </p>
      {merchants.map((merchant) => {
        const open = openId === merchant.id;
        return (
          <article className="rival-row" key={merchant.id}>
            <button aria-expanded={open} onClick={() => setOpenId(open ? null : merchant.id)}>
              <strong>{merchant.name}</strong>
              <span>{getMerchantStanding(merchant)} · {whereabouts(merchant)}</span>
            </button>
            {open && <RivalDetails state={state} merchant={merchant} />}
          </article>
        );
      })}
    </section>
  );
}

/** The latest thing a rival did to this stall, if it's recent enough to still matter. */
export function getStallNews(state: GameState, port: GameState["currentTown"], good: GoodId): string | null {
  const latest = state.npcActivity
    .filter(
      (activity) =>
        activity.town === port &&
        activity.good === good &&
        (activity.kind === "bought" || activity.kind === "sold") &&
        state.worldDay - activity.sailingDay <= 8,
    )
    .at(-1);
  if (!latest) return null;
  const name = state.npcMerchants.find((merchant) => merchant.id === latest.merchantId)?.name ?? "A merchant";
  const days = state.worldDay - latest.sailingDay;
  const when = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return latest.kind === "bought"
    ? `${name} bought ${latest.units ?? "some"} here ${when}`
    : `${name} sold ${latest.units ?? "some"} here ${when}`;
}
