import { useState } from "react";
import {
  LEADERBOARD_INTERVAL_DAYS,
  PLAYER_ENTRY_ID,
  getNextCountDay,
  getPlayerStanding,
  getVisibleEntries,
  type LeaderboardEntry,
  type LeaderboardId,
} from "../game/leaderboard";
import {
  VESSEL_CLASSES,
  formatCoins,
  getSelectedVesselClass,
  getTown,
  type GameState,
} from "../game/model";
import { VesselPortrait } from "./map-art/VesselArt";
import { RivalDetails } from "./RivalMerchants";

const BOARDS: Record<
  LeaderboardId,
  { tab: string; title: string; unit: string; note: string }
> = {
  wealth: {
    tab: "Wealth",
    title: "Wealthiest merchants",
    unit: "Coins",
    note: "Net worth: Coins and route capital, goods at 80% of their usual value, ships and upgrades at 60% of cost, property at 70%, less any debt.",
  },
  influence: {
    tab: "Influence",
    title: "Most influential merchants",
    unit: "influence",
    note: "Personal reputation, the same for you and every rival. Standing in each port doesn't count here.",
  },
};

function Movement({ entry }: { entry: LeaderboardEntry }) {
  if (entry.previousRank === null) return <span className="rank-move" />;
  const change = entry.previousRank - entry.rank;
  if (change === 0) {
    return <span className="rank-move" aria-label="No change since the last count">–</span>;
  }
  const places = `${Math.abs(change)} place${Math.abs(change) === 1 ? "" : "s"}`;
  return (
    <span
      className={`rank-move ${change > 0 ? "rank-move-up" : "rank-move-down"}`}
      aria-label={`${change > 0 ? "Up" : "Down"} ${places} since the last count`}
    >
      {change > 0 ? "▲" : "▼"} {Math.abs(change)}
    </span>
  );
}

function PlayerSummary({ state, board }: { state: GameState; board: LeaderboardId }) {
  const entries = state.leaderboards[board];
  const { entry, above, gap } = getPlayerStanding(entries);
  const value = (amount: number) =>
    board === "wealth" ? `${formatCoins(amount)} Coins` : `${amount} influence`;
  const aboveName = above && state.npcMerchants.find((merchant) => merchant.id === above.id)?.name;
  return (
    <section className="rank-summary" aria-label="Your standing">
      <span className="rank-summary-seal">
        <small>Rank</small>
        {entry.rank}
      </span>
      <div>
        <strong>{state.captainName}, of {entries.length} merchants</strong>
        <p>{value(entry.value)}</p>
        <p>
          {!above
            ? "You lead these rankings."
            : gap === 0
              ? `Level with ${aboveName}, ranked just above you.`
              : `${value(gap)} behind ${aboveName}, ranked ${above.rank}.`}
        </p>
      </div>
      <Movement entry={entry} />
    </section>
  );
}

function RankRow({
  state,
  board,
  entry,
  open,
  onToggle,
}: {
  state: GameState;
  board: LeaderboardId;
  entry: LeaderboardEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const value = (
    <span className="rank-value">
      <strong>{board === "wealth" ? formatCoins(entry.value) : entry.value}</strong>
      <span>{BOARDS[board].unit}</span>
    </span>
  );
  const seal = <span className={`rank-seal${entry.rank <= 3 ? " rank-seal-top" : ""}`}>{entry.rank}</span>;

  if (entry.id === PLAYER_ENTRY_ID) {
    const ships = state.fleet.length;
    return (
      <li className="rank-row rank-row-player">
        <div className="rank-line">
          {seal}
          <VesselPortrait className="rank-ship" vesselClass={getSelectedVesselClass(state).id} />
          <span className="rank-name">
            <strong>{state.captainName}</strong>
            <span>You · {ships} ship{ships === 1 ? "" : "s"}</span>
          </span>
          {value}
          <Movement entry={entry} />
        </div>
      </li>
    );
  }

  const merchant = state.npcMerchants.find((item) => item.id === entry.id);
  if (!merchant) return null;
  const other = board === "wealth" ? "influence" : "wealth";
  const otherEntry = state.leaderboards[other].find((item) => item.id === entry.id);
  return (
    <li className="rank-row">
      <button className="rank-line" aria-expanded={open} onClick={onToggle}>
        {seal}
        <VesselPortrait className="rank-ship" vesselClass={merchant.vesselClass} />
        <span className="rank-name">
          <strong>{merchant.name}</strong>
          <span>{getTown(merchant.homePort).name} · {VESSEL_CLASSES[merchant.vesselClass].name}</span>
        </span>
        {value}
        <Movement entry={entry} />
      </button>
      {open && (
        <div className="rank-details">
          {otherEntry && (
            <p>
              Ranked {otherEntry.rank} for {other} at the last count, with{" "}
              {other === "wealth" ? `${formatCoins(otherEntry.value)} Coins` : `${otherEntry.value} influence`}.
            </p>
          )}
          <RivalDetails state={state} merchant={merchant} />
        </div>
      )}
    </li>
  );
}

export function Leaderboards({ state }: { state: GameState }) {
  const [board, setBoard] = useState<LeaderboardId>("wealth");
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const snapshot = state.leaderboards;
  const entries = snapshot[board];
  const rows = showAll ? entries : getVisibleEntries(entries);
  const firstCount = entries.every((entry) => entry.previousRank === null);

  return (
    <section className="leaderboards" aria-label="Merchant rankings">
      <div className="rank-tabs" role="tablist" aria-label="Choose a ranking">
        {(Object.keys(BOARDS) as LeaderboardId[]).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={board === id}
            className={board === id ? "rank-tab-active" : undefined}
            onClick={() => {
              setBoard(id);
              setOpenId(null);
            }}
          >
            {BOARDS[id].tab}
          </button>
        ))}
      </div>
      <PlayerSummary state={state} board={board} />
      <header className="rank-heading">
        <h3>{BOARDS[board].title}</h3>
        <p>
          Counted on day {snapshot.day}. Next count on day {getNextCountDay(snapshot)}.
          {firstCount ? " Movement shows from the next count." : ""}
        </p>
      </header>
      <ol className="rank-list">
        {rows.map((entry, index) =>
          entry ? (
            <RankRow
              key={entry.id}
              state={state}
              board={board}
              entry={entry}
              open={openId === entry.id}
              onToggle={() => setOpenId(openId === entry.id ? null : entry.id)}
            />
          ) : (
            <li className="rank-gap" key={`gap-${index}`} aria-hidden="true">· · ·</li>
          ),
        )}
      </ol>
      <button className="rank-show-all" onClick={() => setShowAll(!showAll)}>
        {showAll ? "Show the leaders and your rivals" : `Show all ${entries.length} merchants`}
      </button>
      <p className="rank-note">
        {BOARDS[board].note} Rankings are counted every {LEADERBOARD_INTERVAL_DAYS} days.
      </p>
    </section>
  );
}
