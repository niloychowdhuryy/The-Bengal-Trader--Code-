import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AccountPanel from "./components/AccountPanel";
import BengalMap from "./components/BengalMap";
import { CartPortrait } from "./components/map-art/LandCart";
import { VesselPortrait } from "./components/map-art/VesselArt";
import { getRouteStateAt, type RiverRoute } from "./game/navigation";
import CityScene, {
  CITY_BUILDINGS,
  type CityBuildingId,
} from "./components/CityScene";
import {
  CURRENT_MARKET_GOODS,
  MARKET_MAX_STOCK,
  UPGRADES,
  VESSEL_CLASSES,
  VESSEL_CLASS_IDS,
  MAX_AUTOMATED_ROUTE_CAPITAL,
  MAX_PLAYER_SHIPS,
  SHIPYARD_PORTS,
  checkpointVoyageProgress,
  createNewGame,
  formatCoins,
  getCargoCapacity,
  getCargoUsed,
  getWarehouseCapacity,
  getWarehouseUsed,
  FARM_DAILY_OUTPUT,
  FARM_GOOD_ID,
  FARM_OUTPUT_CAPACITY,
  FARM_PRICE,
  MARRIAGE_HOUSEHOLD_COST,
  getGoodPrice,
  getMilestoneProgress,
  getTradeQuote,
  getShipAttack,
  getShipDefence,
  canSelectedShipReach,
  getSelectedVesselClass,
  getShipMaximumHull,
  getShipReturnPlan,
  getShipRouteConditions,
  getShipRoutePreview,
  getVesselMaximumHull,
  isShipOutOfReach,
  getTown,
  getTownRoute,
  getNpcMerchant,
  getNpcTradingIntent,
  isHistoricalRouteAlertActive,
  RESIDENCE_PRICE,
  WAREHOUSE_CAPACITY,
  WAREHOUSE_PRICE,
  type GameState,
  type AutomatedTradeRule,
  type GoodId,
  type Mission,
  type PlayerShip,
  type Screen,
  type TownId,
  type ShipRoutePreview,
  type UpgradeId,
  type VesselClass,
  type VesselClassId,
} from "./game/model";
import { createAccountService, type AccountStatus } from "./online/account";
import { APP_VERSION, getOnlineConfig, getProblemReportUrl } from "./online/config";
import { applyCommand, type CommandResult, type GameCommand, type RecordedCommand } from "./game/commands";
import { NewerSaveError } from "./game/save-format";
import { commitGame, openGameSession, readRawSave, startCommandLog } from "./game/storage";
import { SaveBackupPanel, downloadJson } from "./components/SaveBackupPanel";
import {
  formatInGameDays,
  formatTravelDuration,
  getVoyageProgressMs,
  getVoyageRemainingRealTimeMs,
  SAILING_SPEEDS,
  type SailingSpeed,
} from "./game/travel-time";

type SaveStatus = "loading" | "ready" | "saved" | "saving" | "error";

// The top bar stays narrow on phones, so large balances round down rather than overstate.
function formatCoinsCompact(amount: number): string {
  if (amount < 100_000) return formatCoins(amount);
  if (amount < 1_000_000) return `${Math.floor(amount / 1_000)}k`;
  return `${Math.floor(amount / 10_000) / 100}M`;
}

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#d9b866" stroke="#986c36" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6.4" stroke="#f8e5ad" strokeWidth="1.1" />
      <path d="M14.4 8.7q-.8-1-2.2-1c-1.6 0-2.5.8-2.5 1.8 0 2.8 4.9 1.3 4.9 4.2 0 1.2-1 2.1-2.6 2.1-1 0-2.1-.4-2.8-1.2M12 6.7v10.5" stroke="#815c2f" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  );
}

function CargoMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4 8.3 8-4 8 4v9.3l-8 4-8-4Z" fill="#d7bb88" stroke="#75543b" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4.6 8.5 12 12l7.4-3.5M12 12v9" stroke="#896848" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8.2 6.1 16 10v3" stroke="#f5e4bd" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PortIcon({
  kind,
}: {
  kind: "map" | "market" | "dock" | "fleet" | "city" | "more";
}) {
  if (kind === "map") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 4v14m6-12v14m-7-8q2-3 5-1t5-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "market") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 10h16l-2-5H6Zm1 0v9m14-9v9m-15 0h16M8 14h3m-3 5v-5m8-4v8" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M8 7.6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "fleet") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 16h18l-3 4H7Zm3-2 2-9h8l2 9M12 5V2m-5 5h10M9 10h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "city") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6M8 10h2m4 0h2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "more") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="5" cy="12" r="1.7" fill="currentColor" />
        <circle cx="12" cy="12" r="1.7" fill="currentColor" />
        <circle cx="19" cy="12" r="1.7" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4 17 2-9h12l2 9Zm-2 3h20M8 13h8m-7-9 3 4 3-4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M7 17v3m10-3v3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function GoodIllustration({ good }: { good: GoodId }) {
  const ink = "#2f1d10";
  return (
    <svg className="good-illustration" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <ellipse cx="29" cy="47" rx="19" ry="4" fill="#3a2513" opacity=".22" />
      {good === "rice" && (
        <>
          <path d="M14 46q-5-19 7-26l-3-6q10 3 20 0l-3 6q12 7 7 26-14 5-28 0Z" fill="#cfae76" stroke={ink} strokeWidth="1.5" />
          <path d="M21 20q7 3 14 0" stroke={ink} strokeWidth="1.5" />
          <path d="M19 15q9-6 18 0-9 4-18 0Z" fill="#f4ecd3" stroke={ink} strokeWidth="1.2" />
          <path d="M20 26q-3 9-1 17" stroke="#f0dcae" strokeWidth="2" strokeLinecap="round" />
          <path d="M27 31q-5 3-5 8 5-1 5-8Zm0 0q5 3 5 8-5-1-5-8Zm0 0v12" fill="#7d8f45" stroke={ink} strokeWidth=".9" />
        </>
      )}
      {good === "muslin" && (
        <>
          <path d="M9 42q10-7 19-5t19-5v9q-10 5-19 6t-19 3Z" fill="#b9a67e" stroke={ink} strokeWidth="1.4" />
          <path d="M10 33q9-7 18-5t19-5v9q-10 5-19 5t-18 4Z" fill="#efe4c8" stroke={ink} strokeWidth="1.4" />
          <path d="M11 24q9-7 17-5t18-5v9q-10 5-18 5t-17 4Z" fill="#a8452a" stroke={ink} strokeWidth="1.4" />
          <path d="M14 26q7-5 14-3.5t15-4M14 35q7-5 14-3.5t15-4" stroke="#f8efd9" strokeWidth="1.2" opacity=".85" />
          <ellipse cx="11" cy="28.5" rx="2.5" ry="4.5" fill="#7e2f18" stroke={ink} strokeWidth="1" />
          <ellipse cx="11.5" cy="37.5" rx="2.5" ry="4.5" fill="#d9caa4" stroke={ink} strokeWidth="1" />
        </>
      )}
      {good === "salt" && (
        <>
          <path d="M11 34q17 6 34 0l-3 12q-14 5-28 0Z" fill="#94643a" stroke={ink} strokeWidth="1.5" />
          <path d="M14 38q14 4 28 0m-27 4q13 4 26 0M20 36l1 11m7-10v11m7-11-1 11" stroke={ink} strokeWidth=".9" opacity=".7" />
          <path d="M12 34q5-21 16-23 11 2 16 23-16 6-32 0Z" fill="#f8f4e8" stroke={ink} strokeWidth="1.4" />
          <path d="M27 14q-6 7-8 19m13-16q3 7 3 13" stroke="#c5c1b0" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M20 22l2 2m8-5 2 2m-9 8 2 2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {good === "silk" && (
        <>
          <path d="M11 22q8-9 15 0v22q-7 6-15 0Z" fill="#e0b24f" stroke={ink} strokeWidth="1.4" />
          <path d="M30 22q8-9 15 0v22q-7 6-15 0Z" fill="#c4563a" stroke={ink} strokeWidth="1.4" />
          <path d="M11 28q7 4 15 0m-15 6q7 4 15 0m-15 6q7 4 15 0" stroke="#fff0c0" strokeWidth="1.3" />
          <path d="M30 28q8 4 15 0m-15 6q8 4 15 0m-15 6q8 4 15 0" stroke="#f3b79a" strokeWidth="1.3" />
          <path d="M15 17q13-11 26 0" stroke={ink} strokeWidth="1.5" />
        </>
      )}
      {good === "sugar" && (
        <>
          <path d="m18 45 12-34m-4 34 10-36" stroke="#6f8a3f" strokeWidth="5" strokeLinecap="round" />
          <path d="m18 45 12-34m-4 34 10-36" stroke={ink} strokeWidth=".9" strokeDasharray="9 2 1 2" opacity=".6" />
          <path d="M31 12q-9-5-14 0 7 3 14 0Zm6-3q8-5 12 1-7 3-12-1Z" fill="#83a04a" stroke={ink} strokeWidth="1" />
          <path d="M7 46V34q6-6 13-1v13q-6 4-13 0Z" fill="#e8d4a2" stroke={ink} strokeWidth="1.4" />
          <path d="M9 36q5-3 9 0" stroke={ink} strokeWidth="1" />
          <path d="M34 46q0-9 7-14 7 5 7 14-7 3-14 0Z" fill="#a8673a" stroke={ink} strokeWidth="1.4" />
        </>
      )}
      {good === "saltpetre" && (
        <>
          <path d="M10 28h36v14q-18 7-36 0Z" fill="#7d5430" stroke={ink} strokeWidth="1.5" />
          <path d="M10 34q18 6 36 0M19 30v14m9-14v15m9-15v14" stroke={ink} strokeWidth="1" opacity=".75" />
          <path d="m11 29 6-11 5 4 5-11 7 10 5-5 6 13q-17 6-34 0Z" fill="#eef0ea" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="m27 12-1 16m-9-10 3 11m14-18 1 16" stroke="#b5bcb6" strokeWidth="1.1" />
        </>
      )}
      {good === "opium" && (
        <>
          <path d="M28 46V24M20 46q-1-12-7-18m23 18q2-13 8-18" stroke="#5f7a3a" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="28" cy="17" r="8" fill="#a8b67a" stroke={ink} strokeWidth="1.4" />
          <path d="M21 11q7-5 14 0-7 3-14 0Z" fill="#6f8a4a" stroke={ink} strokeWidth="1" />
          <circle cx="12" cy="24" r="6" fill="#b8c288" stroke={ink} strokeWidth="1.3" />
          <circle cx="45" cy="24" r="6" fill="#98a86c" stroke={ink} strokeWidth="1.3" />
          <path d="M25 15v6m3-7v8m3-7v6" stroke="#6b7a42" strokeWidth=".9" />
        </>
      )}
      {good === "lac" && (
        <>
          <path d="M10 44q-1-7 6-9 7-3 12 0 6 2 12-1 7-1 7 6t-7 8H16q-5 0-6-4Z" fill="#7e2316" stroke={ink} strokeWidth="1.4" />
          <path d="M16 36 28 14l8 3-9 20Zm9 1 7-25 8 2-5 23Z" fill="#b5381f" stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
          <path d="m20 33 8-16m8 18 4-19" stroke="#ee9c6a" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M15 41q6-3 12 0" stroke="#d3684a" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite">
      <div className="loading-seal">B</div>
      <p>Unfurling the river map...</p>
    </main>
  );
}

function IntroScreen({
  existingGame,
  onStart,
  onContinue,
}: {
  existingGame: GameState | null;
  onStart: (name: string) => void;
  onContinue: () => void;
}) {
  const [captainName, setCaptainName] = useState("");

  return (
    <main className="app-shell intro-shell">
      <header className="intro-wordmark">
        <div className="crest" aria-hidden="true">B</div>
        <span>AN ILLUSTRATED RIVER ADVENTURE</span>
      </header>

      <div className="intro-cover">
        <div className="intro-map-art" aria-hidden="true">
          <BengalMap
            interactive={false}
            state={createNewGame("Captain")}
            now={Date.now()}
            onSelectTown={() => undefined}
          />
        </div>
        <div className="cover-wash" />
        <div className="cover-copy">
          <p className="eyebrow cover-kicker">BENGAL · CIRCA 1665</p>
          <h1>The<br />Bengal<br /><em>Trader</em></h1>
          <p className="cover-story">Fifteen river towns. One little boat.<br />A big adventure ahead.</p>
        </div>
        <div className="cover-side-note" aria-hidden="true">RIVERS OF BENGAL</div>
      </div>

      <section className="intro-join">
        <div className="cover-ship" aria-hidden="true">
          <VesselPortrait vesselClass="river-boat" />
        </div>
        <span className="eyebrow">YOUR STORY STARTS IN DHAKA</span>
        <h2>Trade well. Sail far.<br />Make your family proud.</h2>
        <label className="captain-field">
          <span>What should we call you?</span>
          <input
            aria-label="Captain's name"
            autoComplete="given-name"
            maxLength={18}
            onChange={(event) => setCaptainName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onStart(captainName);
            }}
            placeholder="Type your name (optional)"
            value={captainName}
          />
        </label>
        <button className="primary-button intro-start" onClick={() => onStart(captainName)}>
          <span>Begin your story</span>
          <span aria-hidden="true">→</span>
        </button>
        {existingGame && (
          <button className="continue-button" onClick={onContinue}>
            Continue your voyage
          </button>
        )}
        <p className="intro-note">
          An offline-friendly adventure inspired by Bengal's rich trading history.
        </p>
      </section>
    </main>
  );
}

function getRouteModeNote(route: RiverRoute | null): string | null {
  if (!route || route.legs.every((leg) => leg.mode === "water")) return null;
  const first = route.legs[0].mode;
  const last = route.legs[route.legs.length - 1].mode;
  if (first === "land" && last === "land") return "By cart to the landing, by boat, then by cart into town.";
  return first === "land"
    ? "By cart to the landing, then by boat. Your cargo stays with you."
    : "By boat to the landing, then by cart into town. Your cargo stays with you.";
}

function getRouteSizeNote(
  vessel: VesselClass,
  destinationName: string,
  preview: ShipRoutePreview,
): string | null {
  if (preview.tooLarge) {
    return `Your ${vessel.name} is too large for the narrow channels to ${destinationName}. Use a River boat or Bora to go there.`;
  }
  const speedNote =
    vessel.travelFactor > 1
      ? `Your ${vessel.name} is slow: voyages take longer, up to the five-minute maximum.`
      : vessel.travelFactor < 1
        ? `Your ${vessel.name} is quick: voyages take less time.`
        : null;
  if (preview.travelTime && preview.standardTravelTime) {
    return `Longer route: the direct channel is too narrow for your ${vessel.name}. ${formatInGameDays(preview.travelTime.durationDays)} in-game days instead of ${formatInGameDays(preview.standardTravelTime.durationDays)}.${speedNote ? ` ${speedNote}` : ""}`;
  }
  return speedNote;
}

function RouteEmblem() {
  return (
    <div className="route-emblem" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2.2" />
        <path d="M12 7.2V21m-4.5-9.5h9M4 14c.6 4.200 3.8 7 8 7s7.4-2.8 8-7" />
      </svg>
    </div>
  );
}

function RouteNote({
  preview,
  note,
}: {
  preview: ShipRoutePreview;
  note: string | null;
}) {
  if (!note) return null;
  const warning = preview.tooLarge || Boolean(preview.standardTravelTime);
  return <p className={warning ? "route-size-note" : "route-speed-note"}>{note}</p>;
}

function VoyagePanel({
  state,
  now,
  onSail,
  onDefend,
  onSpeedChange,
}: {
  state: GameState;
  now: number;
  onSail: () => void;
  onDefend: () => void;
  onSpeedChange: (speed: SailingSpeed) => void;
}) {
  const voyage = state.voyage;
  const currentPort = getTown(state.currentTown);
  const nextPort = getTown(state.selectedTown);
  const vessel = getSelectedVesselClass(state);
  const selectedPreview = getShipRoutePreview(state, state.selectedTown);
  const selectedRoute = selectedPreview.route;
  const progress = voyage
    ? Math.max(
        0,
        Math.min(
          100,
          (getVoyageProgressMs(
            voyage,
            state.sailingSpeed,
            now,
          ) /
            voyage.durationMs) *
            100,
        ),
      )
    : 0;
  const routeTime = voyage
    ? formatTravelDuration(
        getVoyageRemainingRealTimeMs(
          voyage,
          state.sailingSpeed,
          now,
        ),
      )
    : "";
  const journeyState = voyage
    ? getRouteStateAt(voyage.route, progress / 100, vessel.travelFactor)
    : null;
  const selectedIsCurrent = currentPort.id === nextPort.id;
  const selectedRouteTime = selectedPreview.travelTime;
  const routeSizeNote = selectedIsCurrent
    ? null
    : getRouteSizeNote(vessel, nextPort.name, selectedPreview);

  return (
    <>
      {voyage ? (
        <section className="voyage-card underway-card" aria-live="polite">
          <div className="route-heading">
            <RouteEmblem />
            <div>
              <span className="eyebrow">{voyage.route.legs.length > 1 ? "BOAT AND CART JOURNEY" : "RIVER VOYAGE"}</span>
              <h2>To {getTown(voyage.destination).name}</h2>
            </div>
            <span className="remaining-time">{routeTime}</span>
          </div>
          <div className={`voyage-track${journeyState?.mode === "land" ? " voyage-track-land" : ""}`} aria-hidden="true">
            <span className="voyage-track-waves" />
            <div className="voyage-track-ship" style={{ left: `calc(42px + (100% - 84px) * ${progress / 100})` }}>
              {journeyState?.mode === "land" ? <CartPortrait /> : <VesselPortrait vesselClass={vessel.id} />}
            </div>
          </div>
          {journeyState && voyage.route.legs.length > 1 && (
            <p className="voyage-mode" role="status">
              {journeyState.transferring
                ? "Moving your cargo between boat and cart..."
                : journeyState.mode === "land"
                  ? "Travelling by cart"
                  : "Travelling by boat"}
            </p>
          )}
          <div className="voyage-progress" role="progressbar" aria-label="Voyage progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="voyage-endpoints">
            <span>{getTown(voyage.origin).name}</span>
            <span>
              {getTown(voyage.destination).name} · {formatInGameDays(voyage.durationDays)} in-game days
            </span>
          </div>
          <div className="voyage-speed" role="group" aria-label="Sailing speed">
            <span>Speed</span>
            <div>
              {SAILING_SPEEDS.map((speed) => {
                const speedName =
                  speed === 1 ? "Normal" : speed === 2 ? "Fast" : "Very fast";
                return (
                  <button
                    key={speed}
                    type="button"
                    aria-label={`${speed}× ${speedName}`}
                    aria-pressed={state.sailingSpeed === speed}
                    onClick={() => onSpeedChange(speed)}
                  >
                    {speed}×
                  </button>
                );
              })}
            </div>
          </div>
          <p className="voyage-note">
            {journeyState?.mode === "land"
              ? "The cart keeps to the road. You'll reach town soon."
              : "Keep an eye on the river. You'll dock there soon."}
          </p>
          {voyage.travelEvent && (
            <p className="travel-event-note" role="status">
              {voyage.travelEvent === "river-pilot"
                ? "River pilot ahead: +2 local standing at your destination on arrival."
                : "Rough water ahead: the ship will lose 1 hull on arrival. This event does not interrupt sailing."}
            </p>
          )}
        </section>
      ) : state.encounterPending ? (
        <section className="encounter-card" aria-live="polite">
          <span className="eyebrow encounter-eyebrow">A RIVER ENCOUNTER</span>
          <h2>A raider blocks the channel.</h2>
          <p>A lone river raider is trying to seize your goods. Your ship's upgrades decide how this fight goes.</p>
          <div className="battle-stats">
            <span>Your attack <strong>{getShipAttack(state)}</strong></span>
            <span>Your defence <strong>{getShipDefence(state)}</strong></span>
            <span>Ship strength <strong>{state.shipHull}/{getShipMaximumHull(state)}</strong></span>
          </div>
          <button className="primary-button fight-button" onClick={onDefend}>
            <span>Protect the cargo</span><span aria-hidden="true">→</span>
          </button>
        </section>
      ) : (
        <section className="voyage-card voyage-ready">
          <div className="route-heading">
            <RouteEmblem />
            <div className="destination-copy">
              <span className="eyebrow">YOUR NEXT JOURNEY</span>
              <h2>{selectedIsCurrent ? "Where will you go?" : `Sail to ${nextPort.name}`}</h2>
            </div>
            {!selectedIsCurrent && selectedRoute && selectedRouteTime && (
              <span className="days-pill">
                {formatTravelDuration(selectedRouteTime.durationMs)}
              </span>
            )}
          </div>
          <p className="route-description">
            {selectedIsCurrent
              ? "Tap one of the towns on the map to plot your river route."
              : selectedRoute
                ? `${currentPort.name} to ${nextPort.name}, ${selectedRoute.legs.length > 1 ? "by boat and cart" : "following a direct waterway route"}.`
                : selectedPreview.tooLarge
                  ? `This ship cannot reach ${nextPort.name}.`
                  : `The river path to ${nextPort.name} is blocked. Choose another port.`}
          </p>
          <RouteNote preview={selectedPreview} note={routeSizeNote} />
          {!selectedIsCurrent && getRouteModeNote(selectedRoute) && (
            <p className="route-speed-note">{getRouteModeNote(selectedRoute)}</p>
          )}
          <button
            className="primary-button sail-button"
            disabled={selectedIsCurrent || !selectedRoute}
            onClick={onSail}
          >
            <span>{selectedIsCurrent ? "Choose a town on the map" : selectedRoute ? `Travel to ${nextPort.name}` : selectedPreview.tooLarge ? "Too large for this ship" : "No open river path"}</span>
            <span aria-hidden="true">→</span>
          </button>
          {!selectedIsCurrent && (
            <div className="ship-status">
              <span>Hull strength <strong>{state.shipHull}/{getShipMaximumHull(state)}</strong></span>
              <span className="ship-status-bar"><i style={{ width: `${Math.min(100, (state.shipHull / getShipMaximumHull(state)) * 100)}%` }} /></span>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function HistoricalEventCard({ state }: { state: GameState }) {
  if (!isHistoricalRouteAlertActive(state)) return null;

  return (
    <details className="history-card">
      <summary>
        <span className="history-seal" aria-hidden="true">1666</span>
        <span className="history-summary-copy">
          <span className="eyebrow">DOCUMENTED HISTORY + GAME FICTION</span>
          <strong>1666 campaign · invented route delay</strong>
        </span>
        <span className="details-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="history-details">
        <p>
          <strong>Documented:</strong> A Mughal campaign reached Chittagong in late 1665;
          Mughal forces captured its fort on 26 January 1666 under Shaista Khan's
          administration.
        </p>
        <p>
          <strong>Made for this game:</strong> Our temporary route delay and higher
          salt prices imagine the disruption of a busy coast. They are game rules,
          not documented historical price changes or a recorded port closure.
        </p>
        <a
          href="https://en.banglapedia.org/index.php/Shaista_Khan"
          rel="noreferrer"
          target="_blank"
        >
          Read the Banglapedia history of Shaista Khan ↗
        </a>
      </div>
    </details>
  );
}

function MarketPanel({
  state,
  onBuy,
  onSell,
}: {
  state: GameState;
  onBuy: (good: GoodId, quantity: number) => void;
  onSell: (good: GoodId, quantity: number) => void;
}) {
  const cargoUsed = getCargoUsed(state);
  const cargoLimit = getCargoCapacity(state);
  const [quantities, setQuantities] = useState<Record<GoodId, string>>(
    () => Object.fromEntries(CURRENT_MARKET_GOODS.map((good) => [good.id, "1"])) as Record<GoodId, string>,
  );
  const [pendingTrade, setPendingTrade] = useState<{
    good: GoodId;
    action: "buy" | "sell";
    quantity: number;
  } | null>(null);
  const eventIsActive =
    state.currentTown === "chittagong" &&
    isHistoricalRouteAlertActive(state);
  const formatPrice = (amount: number) =>
    `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(amount)}c`;

  return (
    <section className="feature-panel" aria-label={`Market at ${getTown(state.currentTown).name}`}>
      <div className="feature-heading">
        <span className="eyebrow">THE BUSY QUAYSIDE</span>
        <h2>Market at {getTown(state.currentTown).name}</h2>
        <p>
          Local prices reflect supply, demand and stall stock. As days pass at sea,
          stalls drift back toward their usual stock.
        </p>
      </div>
      {eventIsActive && (
        <div className="market-alert">
          <span className="market-alert-seal">!</span>
          <span>Ships are rerouting during the Chittagong campaign. Salt prices are higher here.</span>
        </div>
      )}
      <div className="cargo-summary">
        <span className="cargo-summary-label">
          <CargoMark /> Your cargo
        </span>
        <strong>{formatCoins(state.coins)} Coins <span>· {cargoUsed}/{cargoLimit} hold</span></strong>
      </div>
      <div className="good-list">
        {CURRENT_MARKET_GOODS.map((good) => {
          const marketStock = state.marketStock[state.currentTown][good.id];
          const buyPrice = getGoodPrice(
            state.currentTown,
            good.id,
            "buy",
            isHistoricalRouteAlertActive(state),
            marketStock,
          );
          const sellPrice = getGoodPrice(
            state.currentTown,
            good.id,
            "sell",
            isHistoricalRouteAlertActive(state),
            marketStock,
          );
          const owned = state.cargo[good.id];
          const averageCost = state.averagePurchasePrice[good.id];
          const quantityText = quantities[good.id];
          const quantity = Number(quantityText);
          const validQuantity = Number.isSafeInteger(quantity) && quantity > 0;
          const buyQuote = validQuantity
            ? getTradeQuote(state, state.currentTown, good.id, "buy", quantity)
            : null;
          const sellQuote = validQuantity
            ? getTradeQuote(state, state.currentTown, good.id, "sell", quantity)
            : null;
          const estimatedSellingValue = owned * sellPrice;
          const estimatedProfit =
            estimatedSellingValue - owned * averageCost;
          const canBuy =
            Boolean(buyQuote) &&
            quantity <= cargoLimit - cargoUsed &&
            buyQuote!.total <= state.coins;
          const canSell =
            Boolean(sellQuote) &&
            quantity <= owned &&
            quantity <= MARKET_MAX_STOCK - marketStock;
          const pendingQuote =
            pendingTrade?.good === good.id
              ? getTradeQuote(
                  state,
                  state.currentTown,
                  good.id,
                  pendingTrade.action,
                  pendingTrade.quantity,
                )
              : null;

          return (
            <div className="market-good" key={good.id}>
              <article className="good-row">
                <GoodIllustration good={good.id} />
                <div className="good-info">
                  <h3>{good.name}</h3>
                  <p>{good.description}</p>
                  <div className="good-prices">
                    <span>Buy <b>{formatPrice(buyPrice)}</b></span>
                    <span>Sell <b>{formatPrice(sellPrice)}</b></span>
                  </div>
                  <span className="stock-meter" aria-hidden="true">
                    <i style={{ width: `${(marketStock / MARKET_MAX_STOCK) * 100}%` }} />
                  </span>
                  <span className="market-stock-line">
                    Stall {marketStock} available · You hold {owned}
                  </span>
                  {owned > 0 && (
                    <span className={`inventory-return${estimatedProfit >= 0 ? " return-positive" : " return-negative"}`}>
                      Avg cost {formatPrice(averageCost)} · Sell est. {formatPrice(estimatedSellingValue)} ({estimatedProfit >= 0 ? "+" : ""}{formatPrice(estimatedProfit)})
                    </span>
                  )}
                </div>
                <div className="good-actions">
                  <label className="quantity-field">
                    <span>Qty</span>
                    <input
                      aria-label={`Quantity of ${good.name}`}
                      inputMode="numeric"
                      min="1"
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [good.id]: event.target.value,
                        }))
                      }
                      type="number"
                      value={quantityText}
                    />
                  </label>
                  <button
                    aria-label={`Buy ${good.name} for ${formatCoins(buyPrice)} Coins`}
                    className="trade-button buy-button"
                    disabled={!canBuy}
                    onClick={() =>
                      setPendingTrade({ good: good.id, action: "buy", quantity })
                    }
                    title={
                      marketStock === 0
                        ? "This stall has sold out"
                        : cargoUsed >= cargoLimit
                          ? "Your cargo hold is full"
                          : undefined
                    }
                  >
                    Buy
                  </button>
                  <button
                    aria-label={`Sell ${good.name} for ${formatCoins(sellPrice)} Coins`}
                    className="trade-button sell-button"
                    disabled={!canSell}
                    onClick={() =>
                      setPendingTrade({ good: good.id, action: "sell", quantity })
                    }
                  >
                    Sell
                  </button>
                </div>
              </article>
              {pendingTrade?.good === good.id && pendingQuote && (
                <div className="trade-confirmation" role="group" aria-label={`${good.name} ${pendingTrade.action} confirmation`}>
                  <p>
                    {pendingTrade.action === "buy" ? "Buy" : "Sell"}{" "}
                    <strong>{pendingTrade.quantity} {good.name}</strong> for{" "}
                    <strong>{formatPrice(pendingQuote.total)}</strong>?
                  </p>
                  <div>
                    <button
                      className="trade-confirm-button"
                      disabled={
                        pendingTrade.action === "buy"
                          ? pendingQuote.total > state.coins ||
                            pendingTrade.quantity > cargoLimit - cargoUsed
                          : pendingTrade.quantity > owned ||
                            pendingTrade.quantity > MARKET_MAX_STOCK - marketStock
                      }
                      onClick={() => {
                        if (pendingTrade.action === "buy") {
                          onBuy(good.id, pendingTrade.quantity);
                        } else {
                          onSell(good.id, pendingTrade.quantity);
                        }
                        setPendingTrade(null);
                      }}
                    >
                      Confirm {pendingTrade.action} · {formatPrice(pendingQuote.total)}
                    </button>
                    <button
                      className="trade-cancel-button"
                      onClick={() => setPendingTrade(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="feature-footnote">
        Bulk totals use the changing local quote for each unit. Estimated returns are not guaranteed profits.
      </p>
    </section>
  );
}

function getVesselSpeedLabel(vessel: VesselClass): string {
  if (vessel.travelFactor < 1) return "fast";
  return vessel.travelFactor > 1 ? "slow" : "normal";
}

function DockPanel({
  state,
  onUpgrade,
  onRepair,
  onBuyShip,
}: {
  state: GameState;
  onUpgrade: (upgrade: UpgradeId) => void;
  onRepair: () => void;
  onBuyShip: (vesselClass: VesselClassId) => void;
}) {
  const [confirmingShipClass, setConfirmingShipClass] =
    useState<VesselClassId | null>(null);
  const vessel = getSelectedVesselClass(state);
  const stats = useMemo(
    () => ({
      attack: getShipAttack(state),
      defence: getShipDefence(state),
      hold: getCargoCapacity(state),
    }),
    [state],
  );
  const maximumHull = getShipMaximumHull(state);
  const hullToRepair = maximumHull - state.shipHull;
  const repairCost = hullToRepair * vessel.repairCostPerHull;
  const canBuyShipHere =
    SHIPYARD_PORTS.includes(state.currentTown) &&
    state.fleet.length < MAX_PLAYER_SHIPS &&
    !state.voyage &&
    !state.encounterPending;

  return (
    <section className="feature-panel dock-panel" aria-label="Shipyard and dock">
      <div className="feature-heading dock-heading">
        <span className="eyebrow">SHIPYARD · {getTown(state.currentTown).name}</span>
        <h2>Shipyard repairs & upgrades</h2>
        <p>{vessel.name}: repair for {formatCoins(vessel.repairCostPerHull)} Coins per missing hull. Upgrade costs and new stats are shown before fitting.</p>
      </div>
      <div className="ship-hero">
        <VesselPortrait vesselClass={vessel.id} />
        <div>
          <h3>{state.fleet.find((ship) => ship.id === state.selectedShipId)?.name}</h3>
          <p>{vessel.name} · your selected ship</p>
        </div>
      </div>
      <div className="shipyard-stats" aria-label="Current boat upgrades">
        <span>Attack <strong>{stats.attack}</strong></span>
        <span>Defence <strong>{stats.defence}</strong></span>
        <span>Hold <strong>{stats.hold}</strong></span>
      </div>
      <div className="upgrade-list">
        {UPGRADES.map((upgrade, index) => {
          const level = state.upgrades[upgrade.id];
          const price = upgrade.baseCost * (level + 1);
          const maxed = level >= upgrade.maxLevel;

          return (
            <article className="upgrade-card" key={upgrade.id}>
              <div className={`upgrade-art upgrade-art-${upgrade.id}`} aria-hidden="true">
                <svg viewBox="0 0 62 62" fill="none">
                  {index === 0 && (
                    <>
                      <path d="M31 8v28M21 34h20l-3 17q-7 4-14 0Z" fill="#ab7750" stroke="#66452f" strokeWidth="2" />
                      <path d="m22 34 9-8 9 8M25 42h12" stroke="#f1d8ae" strokeWidth="2" />
                      <path d="M29 9h4v11h-4Zm-8 40h20" fill="#d7bd85" stroke="#76533b" strokeWidth="1.5" />
                    </>
                  )}
                  {index === 1 && (
                    <>
                      <path d="M9 34q21 14 44 0L46 46q-16 8-32 0Z" fill="#946142" stroke="#60412f" strokeWidth="2" />
                      <path d="M16 34q15 9 31 0M20 38h22M23 43h16" stroke="#dfbd87" strokeWidth="2" />
                      <path d="m25 29 6-7 6 7" fill="#f4e3bf" stroke="#967651" strokeWidth="1.5" />
                    </>
                  )}
                  {index === 2 && (
                    <>
                      <path d="M13 23 31 14l18 9v22l-18 9-18-9Z" fill="#cead76" stroke="#72523a" strokeWidth="2" strokeLinejoin="round" />
                      <path d="m14 24 17 9 17-9M31 33v20m-11-29 17 9v10m-3-19-16 9v10" stroke="#8b6947" strokeWidth="1.8" />
                      <path d="m24 24 16 8" stroke="#f2e0bd" strokeWidth="1.5" />
                    </>
                  )}
                </svg>
              </div>
              <div className="upgrade-copy">
                <div className="upgrade-title-row">
                  <h3>{upgrade.name}</h3>
                  <span>Level {level}/{upgrade.maxLevel}</span>
                </div>
                <p>{upgrade.detail}</p>
                <span className="upgrade-effect">
                  {upgrade.id === "cannon"
                    ? `Attack ${stats.attack} → ${stats.attack + 1}`
                    : upgrade.id === "hull"
                      ? `Defence ${stats.defence} → ${stats.defence + 1} · Hull ${state.shipHull}/${maximumHull} → ${state.shipHull + (level === 0 ? 2 : 1)}/${maximumHull + vessel.hullPerUpgrade}`
                      : `Hold ${stats.hold} → ${stats.hold + vessel.holdPerUpgrade} spaces`}
                </span>
                <span className="upgrade-cost">Next fit · {formatCoins(price)} Coins</span>
              </div>
              <button
                aria-label={
                  maxed
                    ? `${upgrade.name} fully upgraded`
                    : `Upgrade ${upgrade.name} for ${formatCoins(price)} Coins`
                }
                className="upgrade-buy"
                disabled={
                  maxed ||
                  state.coins < price ||
                  Boolean(state.voyage) ||
                  state.encounterPending
                }
                onClick={() => onUpgrade(upgrade.id)}
              >
                {maxed ? <span>Done</span> : <><strong>{formatCoins(price)}c</strong><span>Fit</span></>}
              </button>
            </article>
          );
        })}
      </div>
      <div className="repair-callout">
        <div>
          <strong>Hull {state.shipHull}/{maximumHull}</strong>
          <p>
            {hullToRepair > 0
              ? `Restore ${hullToRepair} hull · ${formatCoins(repairCost)} Coins total (${vessel.repairCostPerHull} per hull).`
              : "Your ship is fully repaired."}
          </p>
        </div>
        <button
          aria-label={
            hullToRepair > 0
              ? `Repair ship for ${formatCoins(repairCost)} Coins`
              : "Ship fully repaired"
          }
          className="repair-button"
          disabled={
            hullToRepair === 0 ||
            state.coins < repairCost ||
            Boolean(state.voyage) ||
            state.encounterPending
          }
          onClick={onRepair}
        >
          {hullToRepair === 0
            ? "Fully repaired"
            : state.coins < repairCost
              ? `Need ${formatCoins(repairCost)}c`
              : `Repair · ${formatCoins(repairCost)}c`}
        </button>
      </div>
      <div className="ship-purchase-panel">
        <div className="ship-purchase-heading">
          <strong>Buy another boat</strong>
          <p>
            {SHIPYARD_PORTS.includes(state.currentTown)
              ? "Each boat stays at its own port until you sail it."
              : `Available at ${SHIPYARD_PORTS.map((port) => getTown(port).name).join(", ")}.`}
          </p>
          <span>{state.fleet.length}/{MAX_PLAYER_SHIPS} ships owned</span>
        </div>
        <div className="ship-class-list">
          {VESSEL_CLASS_IDS.map((classId) => {
            const shipClass = VESSEL_CLASSES[classId];
            const portLimit =
              classId === "patello" ? "Cannot reach Sylhet or Balasore" : "Reaches all 15 ports";
            return (
              <article className="ship-class-card" key={classId}>
                <VesselPortrait vesselClass={classId} />
                <div className="ship-class-copy">
                  <h3>{shipClass.name}</h3>
                  <p>{shipClass.summary}</p>
                </div>
                <ul className="ship-class-stats">
                  <li>Hold <b>{shipClass.baseHold}</b></li>
                  <li>Hull <b>{shipClass.baseHull}</b></li>
                  <li>Speed <b>{getVesselSpeedLabel(shipClass)}</b></li>
                  <li>Repair <b>{formatCoins(shipClass.repairCostPerHull)}c</b> per hull</li>
                  <li>Route trade <b>{shipClass.routeUnitsPerGood}</b> per good</li>
                </ul>
                <p className={`ship-class-reach${classId === "patello" ? " ship-class-reach-limited" : ""}`}>{portLimit}</p>
                {confirmingShipClass === classId ? (
                  <div
                    className="ship-purchase-confirmation"
                    role="group"
                    aria-label="Buy ship confirmation"
                  >
                    <p>
                      Buy an empty {shipClass.name} for {formatCoins(shipClass.price)} Coins?
                      {classId === "patello" ? " It cannot reach Sylhet or Balasore." : ""}
                    </p>
                    <div>
                      <button
                        className="ship-buy-button"
                        onClick={() => {
                          onBuyShip(classId);
                          setConfirmingShipClass(null);
                        }}
                      >
                        Confirm · {formatCoins(shipClass.price)}c
                      </button>
                      <button
                        className="ship-cancel-button"
                        onClick={() => setConfirmingShipClass(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    aria-label={`Buy ${shipClass.name} for ${formatCoins(shipClass.price)} Coins`}
                    className="ship-buy-button"
                    disabled={!canBuyShipHere || state.coins < shipClass.price}
                    onClick={() => setConfirmingShipClass(classId)}
                  >
                    {state.fleet.length >= MAX_PLAYER_SHIPS
                      ? "Fleet full"
                      : state.coins < shipClass.price
                        ? `Need ${formatCoins(shipClass.price)}c`
                        : `Buy · ${formatCoins(shipClass.price)}c`}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <p className="ship-class-note">
          Bora and Patello are named after boats in 17th-century records of
          Bengal. Their stats, prices, shipyards and port limits are game rules,
          not historical facts.
        </p>
      </div>
    </section>
  );
}

function PortContextPanel({
  state,
  expanded,
  onToggle,
  onHeightChange,
  onTravel,
  onEnterCity,
}: {
  state: GameState;
  expanded: boolean;
  onToggle: () => void;
  /** How much of the map this panel covers, so the map can move clear of it. */
  onHeightChange: (height: number) => void;
  onTravel: () => void;
  onEnterCity: () => void;
}) {
  const destination = getTown(state.selectedTown);
  const isHere = state.selectedTown === state.currentTown;
  const preview = isHere ? null : getShipRoutePreview(state, state.selectedTown);
  const route = preview?.route ?? null;
  const routeTime = preview?.travelTime ?? null;
  const routeSizeNote = preview
    ? getRouteSizeNote(getSelectedVesselClass(state), destination.name, preview)
    : null;
  const dockedMerchants = state.npcMerchants.filter(
    (merchant) => merchant.phase === "docked" && merchant.currentPort === destination.id,
  );
  const recentPortActivity = state.npcActivity
    .filter((activity) => activity.town === destination.id)
    .at(-1);
  const summary = isHere
    ? "Your ship is here"
    : route && routeTime
      ? `${formatTravelDuration(routeTime.durationMs)} · ${route.legs.length > 1 ? "boat and cart" : "by water"}${preview?.standardTravelTime ? " · longer route" : ""}`
      : preview?.tooLarge
        ? "Too large for this ship"
        : "Route closed";
  const actionName = isHere
    ? "Enter city"
    : route
      ? `Travel to ${destination.name}`
      : preview?.tooLarge
        ? "Too large for this ship"
        : "Route unavailable";
  const shortActionName = isHere
    ? "Enter city"
    : route
      ? "Travel"
      : preview?.tooLarge
        ? "Too large"
        : "Closed";

  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      // A panel docked beside the map, as on landscape phones, covers none of it.
      const overlays = getComputedStyle(panel).position === "absolute";
      const bottomGap = overlays
        ? (panel.offsetParent?.getBoundingClientRect().bottom ?? 0) -
          panel.getBoundingClientRect().bottom
        : 0;
      onHeightChange(overlays ? panel.getBoundingClientRect().height + bottomGap : 0);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(panel);
    return () => {
      observer?.disconnect();
      onHeightChange(0);
    };
  }, [onHeightChange]);

  return (
    <section
      ref={panelRef}
      className={`port-context-panel${expanded ? " port-context-expanded" : ""}`}
      aria-live="polite"
    >
      <div className="port-panel-bar">
        <div className="port-panel-title">
          <h2>{destination.name}</h2>
          <p>{summary}</p>
        </div>
        <button
          type="button"
          className="port-panel-toggle"
          aria-expanded={expanded}
          aria-controls="port-panel-details"
          aria-label={expanded ? "Hide port details" : "Show port details"}
          onClick={onToggle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={expanded ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"} />
          </svg>
          <span>{expanded ? "Less" : "Details"}</span>
        </button>
        <button
          className="primary-button port-context-action"
          aria-label={actionName}
          disabled={!isHere && !route}
          onClick={isHere ? onEnterCity : onTravel}
        >
          <span className="port-action-long">{actionName}</span>
          <span className="port-action-short">{shortActionName}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
      {expanded && (
        <div className="port-context-copy" id="port-panel-details">
          <span className="eyebrow">{isHere ? "YOUR CURRENT PORT" : "RIVER ROUTE"}</span>
          <p>
            {isHere
              ? "You are safely docked. Visit the town or get ready for your next voyage."
              : route
                ? routeTime
                  ? `${route.legs.length > 1 ? "Boat and cart route" : "Direct waterway route"} · ${formatTravelDuration(routeTime.durationMs)} · ${formatInGameDays(routeTime.durationDays)} in-game days`
                  : "A river section is closed. No safe water route is open right now."
                : preview?.tooLarge
                  ? "This ship cannot reach this port."
                  : "A river section is closed. No safe water route is open right now."}
          </p>
          {preview && <RouteNote preview={preview} note={routeSizeNote} />}
          {getRouteModeNote(route) && <p className="route-speed-note">{getRouteModeNote(route)}</p>}
          <p className="npc-port-traffic">
            {dockedMerchants.length
              ? `At this port: ${dockedMerchants.map((merchant) => merchant.name).join(", ")}.`
              : "No NPC merchants are docked here right now."}
            {recentPortActivity
              ? ` Latest: ${getNpcMerchant(state, recentPortActivity.merchantId)?.name ?? "A merchant"} ${recentPortActivity.message}.`
              : ""}
          </p>
        </div>
      )}
    </section>
  );
}

function AutomatedRoutePanel({
  state,
  ship,
  onConfigure,
  onStatus,
  onCancel,
}: {
  state: GameState;
  ship: PlayerShip;
  onConfigure: (
    shipId: string,
    destination: TownId,
    rules: AutomatedTradeRule[],
    initialCapital: number,
  ) => void;
  onStatus: (shipId: string, status: "running" | "paused") => void;
  onCancel: (shipId: string) => void;
}) {
  const existingRoute = ship.automatedRoute;
  const vessel = VESSEL_CLASSES[ship.vesselClass];
  const visitedDestinations = state.visitedTowns.filter(
    (port) => port !== ship.currentPort,
  );
  const availableDestinations = visitedDestinations.filter(
    (port) =>
      getTownRoute(
        ship.currentPort,
        port,
        getShipRouteConditions(state.navigationConditions, ship.vesselClass),
      ) !== null,
  );
  const hiddenDestinations = visitedDestinations.filter(
    (port) => !availableDestinations.includes(port),
  );
  const [editing, setEditing] = useState(false);
  const [destination, setDestination] = useState<string>(
    existingRoute?.destination !== ship.currentPort
      ? existingRoute?.destination ?? availableDestinations[0] ?? ""
      : availableDestinations[0] ?? "",
  );
  const [capital, setCapital] = useState("25000");
  const [rules, setRules] = useState<
    Record<GoodId, { enabled: boolean; buyAtOrigin: boolean; sellAtDestination: boolean }>
  >(() => {
    const savedRules = new Map(
      (existingRoute?.rules ?? []).map((rule) => [rule.good, rule]),
    );
    return Object.fromEntries(
      CURRENT_MARKET_GOODS.map((good) => {
        const saved = savedRules.get(good.id);
        return [
          good.id,
          {
            enabled: Boolean(saved) || good.id === "rice",
            buyAtOrigin: saved?.buyAtOrigin ?? true,
            sellAtDestination: saved?.sellAtDestination ?? true,
          },
        ];
      }),
    ) as Record<
      GoodId,
      { enabled: boolean; buyAtOrigin: boolean; sellAtDestination: boolean }
    >;
  });

  const selectedRules = CURRENT_MARKET_GOODS.flatMap((good) => {
    const rule = rules[good.id];
    return rule.enabled
      ? [{
          good: good.id,
          buyAtOrigin: rule.buyAtOrigin,
          sellAtDestination: rule.sellAtDestination,
        }]
      : [];
  });
  const destinationPort = availableDestinations.find(
    (port) => port === destination,
  );
  const needsDeposit = !existingRoute;
  const capitalAmount = Number(capital);
  const validCapital =
    !needsDeposit ||
    (Number.isSafeInteger(capitalAmount) &&
      capitalAmount > 0 &&
      capitalAmount <= MAX_AUTOMATED_ROUTE_CAPITAL &&
      capitalAmount <= state.coins);
  const validRules =
    selectedRules.length > 0 &&
    selectedRules.some((rule) => rule.buyAtOrigin) &&
    selectedRules.some((rule) => rule.sellAtDestination);

  const beginEditing = () => {
    if (existingRoute) {
      setDestination(
        existingRoute.destination !== ship.currentPort
          ? existingRoute.destination
          : availableDestinations[0] ?? "",
      );
      setRules((current) => {
        const savedRules = new Map(
          existingRoute.rules.map((rule) => [rule.good, rule]),
        );
        return Object.fromEntries(
          CURRENT_MARKET_GOODS.map((good) => {
            const saved = savedRules.get(good.id);
            return [
              good.id,
              {
                enabled: Boolean(saved),
                buyAtOrigin: saved?.buyAtOrigin ?? false,
                sellAtDestination: saved?.sellAtDestination ?? false,
              },
            ];
          }),
        ) as typeof current;
      });
    }
    setEditing(true);
  };

  return (
    <section className="automated-route-panel" aria-label={`${ship.name} automated trade route`}>
      {!existingRoute && (
        <div className="automated-route-summary">
          <div className="automated-route-heading">
            <strong>No automated route</strong>
          </div>
          <p>Assign this ship to trade between ports you have visited.</p>
          <div className="automated-route-actions">
            <button onClick={beginEditing}>Set up route</button>
          </div>
        </div>
      )}
      {existingRoute && (
        <div className="automated-route-summary">
          <div className="automated-route-heading">
            <strong>Automated route</strong>
            <span>
              {existingRoute.status === "paused"
                ? "Paused"
                : existingRoute.phase === "traveling"
                  ? `Sailing · ${existingRoute.travelDaysRemaining}/${existingRoute.travelDaysTotal} days left`
                  : "Running · docked"}
            </span>
          </div>
          <p>
            {getTown(existingRoute.origin).name} ↔ {getTown(existingRoute.destination).name}
            {existingRoute.phase === "traveling"
              ? ` · heading to ${getTown(existingRoute.destinationPort).name}`
              : ` · at ${getTown(ship.currentPort).name}`}
          </p>
          <p>Route capital: {formatCoins(existingRoute.capital)} Coins</p>
          <p>
            Rules: {existingRoute.rules.map((rule) => {
              const good = CURRENT_MARKET_GOODS.find((entry) => entry.id === rule.good);
              return `${good?.name ?? rule.good} (${[
                rule.buyAtOrigin ? "buy at start" : "",
                rule.sellAtDestination ? "sell at end" : "",
              ].filter(Boolean).join(", ")})`;
            }).join(" · ")}
          </p>
          <div className="automated-route-actions">
            <button
              disabled={existingRoute.phase !== "docked"}
              onClick={() =>
                onStatus(
                  ship.id,
                  existingRoute.status === "running" ? "paused" : "running",
                )
              }
            >
              {existingRoute.status === "running" ? "Pause" : "Resume"}
            </button>
            <button
              disabled={existingRoute.phase !== "docked"}
              onClick={beginEditing}
            >
              Edit
            </button>
            <button
              className="automated-route-cancel"
              disabled={existingRoute.phase !== "docked"}
              onClick={() => onCancel(ship.id)}
            >
              Cancel route
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="automated-route-editor">
          <h4>{existingRoute ? "Edit at this port" : "Set up an automated route"}</h4>
          <p>
            The ship starts at {getTown(ship.currentPort).name}. This{" "}
            {vessel.name} trades{" "}
            {vessel.routeUnitsPerGood === 1
              ? "one unit"
              : `up to ${vessel.routeUnitsPerGood} units`}{" "}
            per selected good at each port call, within its hold, stall stock
            and route capital, and follows connected river routes. Route
            progress advances only while your voyage is active.
          </p>
          <label className="route-destination-field">
            <span>Other visited port</span>
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              {availableDestinations.length === 0 && (
                <option value="">Visit another port first</option>
              )}
              {availableDestinations.map((port) => (
                <option key={port} value={port}>{getTown(port).name}</option>
              ))}
            </select>
          </label>
          {hiddenDestinations.length > 0 && (
            <p className="route-capital-note route-hidden-note">
              Not offered, because this {vessel.name} cannot reach them right
              now: {hiddenDestinations.map((port) => getTown(port).name).join(", ")}.
            </p>
          )}
          <div className="route-goods-list">
            {CURRENT_MARKET_GOODS.map((good) => {
              const rule = rules[good.id];
              return (
                <fieldset className="route-good-rule" key={good.id}>
                  <legend>
                    <label>
                      <input
                        checked={rule.enabled}
                        type="checkbox"
                        onChange={(event) =>
                          setRules((current) => ({
                            ...current,
                            [good.id]: {
                              ...current[good.id],
                              enabled: event.target.checked,
                            },
                          }))
                        }
                      />
                      {good.name}
                    </label>
                  </legend>
                  <label>
                    <input
                      checked={rule.buyAtOrigin}
                      disabled={!rule.enabled}
                      type="checkbox"
                      onChange={(event) =>
                        setRules((current) => ({
                          ...current,
                          [good.id]: {
                            ...current[good.id],
                            buyAtOrigin: event.target.checked,
                          },
                        }))
                      }
                    />
                    Buy at {getTown(ship.currentPort).name}
                  </label>
                  <label>
                    <input
                      checked={rule.sellAtDestination}
                      disabled={!rule.enabled}
                      type="checkbox"
                      onChange={(event) =>
                        setRules((current) => ({
                          ...current,
                          [good.id]: {
                            ...current[good.id],
                            sellAtDestination: event.target.checked,
                          },
                        }))
                      }
                    />
                    Sell at other port
                  </label>
                </fieldset>
              );
            })}
          </div>
          {needsDeposit && (
            <label className="route-capital-field">
              <span>Starting trade capital (max {formatCoins(MAX_AUTOMATED_ROUTE_CAPITAL)})</span>
              <input
                inputMode="numeric"
                min="1"
                max={MAX_AUTOMATED_ROUTE_CAPITAL}
                type="number"
                value={capital}
                onChange={(event) => setCapital(event.target.value)}
              />
            </label>
          )}
          {existingRoute && (
            <p className="route-capital-note">
              Editing keeps the current {formatCoins(existingRoute.capital)} Coins route capital.
            </p>
          )}
          <div className="automated-route-actions">
            <button
              disabled={!destinationPort || !validRules || !validCapital}
              onClick={() => {
                if (!destinationPort) return;
                onConfigure(
                  ship.id,
                  destinationPort,
                  selectedRules,
                  needsDeposit ? capitalAmount : 0,
                );
                setEditing(false);
              }}
            >
              {existingRoute ? "Save route" : "Start route"}
            </button>
            {existingRoute && (
              <button onClick={() => setEditing(false)}>Keep current route</button>
            )}
          </div>
          {!existingRoute && (
            <p className="route-capital-note">
              Your purse has {formatCoins(state.coins)} Coins. Starting capital is transferred
              to the route.
              {" "}
              Sales go into route capital, not your purse, until you cancel the
              route. No missions or reputation are awarded for automatic trades.
            </p>
          )}
        </div>
      )}

      {ship.automationLog.length > 0 && (
        <details className="automated-route-log">
          <summary>Recent automated activity</summary>
          <ul>
            {[...ship.automationLog].reverse().map((entry, index) => (
              <li key={`${entry.sailingDay}:${index}`}>
                Day {entry.sailingDay} · {getTown(entry.port).name} · {entry.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function FutureSystemsPanel({
  screen,
  state,
  onSelectShip,
  onReturnShip,
  onConfigureRoute,
  onRouteStatus,
  onCancelRoute,
}: {
  screen: Extract<Screen, "fleet" | "politics" | "family" | "properties" | "notifications">;
  state: GameState;
  onSelectShip: (shipId: string) => void;
  onReturnShip: (shipId: string) => void;
  onConfigureRoute: (
    shipId: string,
    destination: TownId,
    rules: AutomatedTradeRule[],
    initialCapital: number,
  ) => void;
  onRouteStatus: (shipId: string, status: "running" | "paused") => void;
  onCancelRoute: (shipId: string) => void;
}) {
  if (screen === "fleet") {
    const activeShip = state.fleet.find(
      (ship) => ship.id === state.selectedShipId,
    )!;
    return (
      <section className="feature-panel fleet-panel" aria-label="Fleet">
        <span className="eyebrow">YOUR FLEET</span>
        <h2>{state.fleet.length} {state.fleet.length === 1 ? "ship" : "ships"}</h2>
        <p>
          Only one ship can sail under your direct control at a time. Assigned
          ships follow their saved routes; unassigned ships stay at their last port.
        </p>
        <div className="fleet-stat-line">
          <span>Attack <strong>{getShipAttack(state)}</strong></span>
          <span>Defence <strong>{getShipDefence(state)}</strong></span>
          <span>Hold <strong>{getCargoCapacity(state)}</strong></span>
          <span>Hull <strong>{state.shipHull}/{getShipMaximumHull(state)}</strong></span>
        </div>
        <div className="fleet-ship-list">
          {state.fleet.map((ship) => {
            const isSelected = ship.id === state.selectedShipId;
            const canSwitch =
              !state.voyage &&
              !state.encounterPending &&
              !ship.returnOrder &&
              ship.currentPort === state.currentTown;
            const shipClass = VESSEL_CLASSES[ship.vesselClass];
            const outOfReach = isShipOutOfReach(state, ship.id);
            const returnPlan = getShipReturnPlan(state, ship.id);
            const cargoUsed = Object.values(ship.cargo).reduce(
              (total, count) => total + count,
              0,
            );
            return (
              <article
                className={`fleet-ship-card${isSelected ? " fleet-ship-selected" : ""}`}
                key={ship.id}
              >
                <div className="fleet-ship-heading">
                  <VesselPortrait vesselClass={ship.vesselClass} />
                  <div>
                    <h3>{ship.name}</h3>
                    <span>
                      {shipClass.name} ·{" "}
                      {state.voyage?.shipId === ship.id
                        ? `At sea · to ${getTown(state.voyage.destination).name}`
                        : ship.returnOrder
                          ? `Returning to ${getTown(ship.returnOrder.destination).name}`
                          : getTown(ship.currentPort).name}
                    </span>
                  </div>
                  <strong>
                    {isSelected
                      ? state.voyage
                        ? "Managing · at sea"
                        : "Managing"
                      : ship.automatedRoute
                        ? "Automated"
                        : ship.returnOrder
                          ? "Returning"
                          : "Docked"}
                  </strong>
                </div>
                <div className="fleet-ship-stats">
                  <span>Hull {ship.shipHull}/{getVesselMaximumHull(ship.vesselClass, ship.upgrades)}</span>
                  <span>Cargo {cargoUsed}/{ship.cargoCapacity}</span>
                  <span>Speed {getVesselSpeedLabel(shipClass)}</span>
                  {ship.vesselClass === "patello" && <span>Reaches 13 of 15 ports</span>}
                </div>
                {ship.returnOrder && (
                  <p className="fleet-automation-note">
                    Returning to {getTown(ship.returnOrder.destination).name} ·{" "}
                    {ship.returnOrder.travelDaysRemaining} in-game{" "}
                    {ship.returnOrder.travelDaysRemaining === 1 ? "day" : "days"} left.
                    It moves only while your voyage is under way.
                  </p>
                )}
                {outOfReach && (
                  <div className="fleet-return-order">
                    <p>
                      Your {getSelectedVesselClass(state).name} cannot reach this
                      ship at {getTown(ship.currentPort).name}.
                      {returnPlan
                        ? " Order it back to where you can meet it."
                        : " No river route is open for it right now."}
                    </p>
                    {returnPlan && (
                      <button
                        className="fleet-select-button"
                        onClick={() => onReturnShip(ship.id)}
                      >
                        Return to {getTown(returnPlan.destination).name} · {returnPlan.days}{" "}
                        {returnPlan.days === 1 ? "day" : "days"}
                      </button>
                    )}
                  </div>
                )}
                {!isSelected && !ship.automatedRoute && !ship.returnOrder && !outOfReach && (
                  <button
                    className="fleet-select-button"
                    disabled={!canSwitch}
                    onClick={() => onSelectShip(ship.id)}
                  >
                    {ship.currentPort === state.currentTown
                      ? "Manage this ship"
                      : `At ${getTown(ship.currentPort).name}`}
                  </button>
                )}
                {!isSelected && ship.automatedRoute && (
                  <p className="fleet-automation-note">
                    Managed by this ship's saved automated route.
                  </p>
                )}
                <details className="fleet-cargo-details" open={isSelected}>
                  <summary>Cargo · {cargoUsed}/{ship.cargoCapacity}</summary>
                  <div
                    className="fleet-cargo-list"
                    aria-label={`${ship.name} cargo`}
                  >
                    {CURRENT_MARKET_GOODS.map((good) => (
                      <span key={good.id}>
                        {good.name} <strong>{ship.cargo[good.id]}</strong>
                      </span>
                    ))}
                  </div>
                </details>
                {!isSelected && !ship.returnOrder && (
                  <AutomatedRoutePanel
                    key={`${ship.id}:${ship.automatedRoute ? "assigned" : "none"}`}
                    state={state}
                    ship={ship}
                    onConfigure={onConfigureRoute}
                    onStatus={onRouteStatus}
                    onCancel={onCancelRoute}
                  />
                )}
              </article>
            );
          })}
        </div>
        <p className="fleet-active-note">
          Active ship: <strong>{activeShip.name}</strong>
          {state.voyage ? ` · sailing to ${getTown(state.voyage.destination).name}` : ""}
        </p>
      </section>
    );
  }

  if (screen === "notifications") {
    return (
      <section className="future-panel" aria-label="Notifications">
        <span className="eyebrow">CAPTAIN'S NOTES</span>
        <h2>{state.lastMessage || "All quiet on the river"}</h2>
        <p>
          {isHistoricalRouteAlertActive(state)
            ? "A campaign is changing routes near Chittagong. Its travel and salt-price effects are game fiction."
            : "No new notices. Your voyage is saved on this device."}
        </p>
      </section>
    );
  }

  if (screen === "politics") {
    const standing = state.localStanding[state.currentTown];
    const standingLabel =
      standing >= 60 ? "Trusted locally" : standing >= 25 ? "Known in port" : "New to local affairs";
    return (
      <section className="future-panel politics-panel" aria-label="Local political standing">
        <span className="eyebrow">LOCAL STANDING · {getTown(state.currentTown).name.toUpperCase()}</span>
        <h2>{standingLabel}</h2>
        <p>{standing}/100 standing. Complete city contracts to earn +5 in the issuing port; occasional river pilots can add +2 at your destination.</p>
        <p>Standing currently has no price, permission, city, or goods unlock effects.</p>
      </section>
    );
  }

  const content = {
    family: {
      eyebrow: "HOUSEHOLD",
      title: "Your family's story is just beginning",
      description: "A home and household will grow from local relationships. No family members or succession are implemented yet.",
    },
    properties: {
      eyebrow: "LAND & BUSINESSES",
      title: "Build a good name before buying land",
      description: "Earn local trust, ask authorities for permission, then choose farms and workshops suited to each town.",
    },
  }[screen];

  return (
    <section className="future-panel" aria-label={content.eyebrow}>
      <span className="eyebrow">{content.eyebrow}</span>
      <h2>{content.title}</h2>
      <p>{content.description}</p>
    </section>
  );
}

function ProgressPanel({ state }: { state: GameState }) {
  const milestones = getMilestoneProgress(state);
  return (
    <section className="progress-panel future-panel" aria-label="Reputation and milestones">
      <div className="progress-summary">
        <div>
          <span className="eyebrow">YOUR STANDING</span>
          <h2>{state.reputation} reputation</h2>
        </div>
        <span className="progress-seal" aria-hidden="true">✦</span>
      </div>
      <p className="progress-explanation">
        Gain 1 reputation the first time you visit a port and the first time you
        make a profitable sale of each good in each port. Repeating the same
        visit or trade will not farm reputation.
      </p>
      <div className="milestone-list">
        {milestones.map((milestone) => (
          <article
            className={`milestone-card${milestone.completed ? " milestone-complete" : ""}`}
            key={milestone.id}
          >
            <div className="milestone-copy">
              <span className="eyebrow">
                {milestone.completed ? "OPTIONAL GOAL · COMPLETE" : "OPTIONAL GOAL"}
              </span>
              <h3>{milestone.title}</h3>
              <p>{milestone.description}</p>
            </div>
            <div
              className="milestone-progress"
              role="progressbar"
              aria-label={`${milestone.title} progress`}
              aria-valuenow={milestone.current}
              aria-valuemin={0}
              aria-valuemax={milestone.target}
            >
              <strong>{milestone.current}/{milestone.target}</strong>
              <span><i style={{ width: `${(milestone.current / milestone.target) * 100}%` }} /></span>
            </div>
          </article>
        ))}
      </div>
      <p className="progress-footnote">
        These goals are only for direction: every port and good stays available,
        and you can keep trading after completing them.
      </p>
    </section>
  );
}

function missionDescription(mission: Mission): string {
  const destination = getTown(mission.destination).name;
  const good = mission.good
    ? CURRENT_MARKET_GOODS.find((item) => item.id === mission.good)?.name ?? mission.good
    : null;
  if (mission.type === "delivery") {
    return `Deliver ${mission.quantity} ${good} to ${destination}.`;
  }
  if (mission.type === "purchase_delivery") {
    return `Buy ${mission.quantity} ${good} here, then deliver it to ${destination}.`;
  }
  if (mission.type === "visit") {
    return `Visit ${destination} before the deadline.`;
  }
  return `Earn ${formatCoins(mission.targetProfit)} Coins profit selling ${good} in ${destination}.`;
}

function missionProgressLabel(mission: Mission): string {
  if (mission.type === "delivery") {
    return `${mission.progress}/${mission.quantity} delivered`;
  }
  if (mission.type === "purchase_delivery") {
    return `${mission.purchasedQuantity}/${mission.quantity} bought · ${mission.progress}/${mission.quantity} delivered`;
  }
  if (mission.type === "visit") return `${mission.progress}/1 port visited`;
  return `${Math.floor(mission.progress)}/${formatCoins(mission.targetProfit)} Coins profit`;
}

function MissionBoardPanel({
  state,
  onAccept,
}: {
  state: GameState;
  onAccept: (missionId: string) => void;
}) {
  const offers = state.missions.filter(
    (mission) => mission.origin === state.currentTown && mission.status === "available",
  );
  const active = state.missions.filter((mission) => mission.status === "active");
  const completed = state.missions.filter((mission) => mission.status === "completed");
  const expired = state.missions.filter((mission) => mission.status === "expired");
  const renderMission = (mission: Mission, canAccept: boolean) => (
    <article
      className={`mission-card mission-${mission.status}`}
      key={mission.id}
      aria-label={`${mission.status} contract`}
    >
      <div>
        <span className="eyebrow">{mission.status.replace("_", " ").toUpperCase()} · {mission.type.replace("_", " ")}</span>
        <h3>{missionDescription(mission)}</h3>
        {mission.status === "active" ? (
          <p>
            {missionProgressLabel(mission)} · due by sailing day{" "}
            {mission.deadlineSailingDay?.toFixed(1)}
          </p>
        ) : (
          <p>{mission.deadlineDays} in-game days after acceptance · one-time reward</p>
        )}
        <p className="mission-reward">
          Reward: {formatCoins(mission.rewardCoins)} Coins · +2 global reputation · +5 local standing in{" "}
          {getTown(mission.origin).name}
        </p>
        {mission.status !== "completed" &&
          mission.status !== "expired" &&
          !canSelectedShipReach(state, mission.destination) && (
            <p className="route-size-note">
              Your {getSelectedVesselClass(state).name} cannot reach{" "}
              {getTown(mission.destination).name}. Use another ship for this contract.
            </p>
          )}
      </div>
      {canAccept && (
        <button
          className="primary-button mission-accept"
          disabled={active.length >= 2}
          onClick={() => onAccept(mission.id)}
        >
          {active.length >= 2 ? "2 contracts active" : "Accept contract"}
        </button>
      )}
    </article>
  );

  return (
    <section className="mission-board feature-panel" aria-label="Mission board">
      <div className="feature-heading">
        <span className="eyebrow">MISSION BOARD · {getTown(state.currentTown).name.toUpperCase()}</span>
        <h2>Trade contracts & journeys</h2>
        <p>Optional contracts use sailing days for deadlines. Rewards are paid once; expired contracts cannot be repeated.</p>
      </div>
      <div className="mission-summary">
        <span>Global reputation <strong>{state.reputation}</strong></span>
        <span>Local standing <strong>{state.localStanding[state.currentTown]}/100</strong></span>
        <span>Active <strong>{active.length}/2</strong></span>
      </div>
      <h3 className="mission-section-title">Offers here</h3>
      {offers.length ? (
        <div className="mission-list">{offers.map((mission) => renderMission(mission, true))}</div>
      ) : (
        <p className="mission-empty">No new contracts are posted here.</p>
      )}
      <h3 className="mission-section-title">Active contracts</h3>
      {active.length ? (
        <div className="mission-list">{active.map((mission) => renderMission(mission, false))}</div>
      ) : (
        <p className="mission-empty">You have no active contracts.</p>
      )}
      <details className="mission-history">
        <summary>Past contracts · {completed.length} completed · {expired.length} expired</summary>
        {[...completed, ...expired].map((mission) => renderMission(mission, false))}
      </details>
      <p className="feature-footnote">
        Local standing is a separate, non-gating measure. Contracts never lock a port or good.
      </p>
    </section>
  );
}

function HouseholdPanel({ state }: { state: GameState }) {
  const residence = state.residenceTown
    ? getTown(state.residenceTown).name
    : null;
  const spouse = state.household.spouse !== null;

  return (
    <section className="household-panel future-panel" aria-label="Household">
      <span className="eyebrow">HOUSEHOLD</span>
      <h2>{spouse ? "Your household" : "A household begins at home"}</h2>
      <div className="household-facts">
        <p><strong>Residence</strong><span>{residence ?? "None established"}</span></p>
        <p>
          <strong>Spouse</strong>
          <span>
            {state.household.spouse
              ? `Married · sailing day ${state.household.spouse.marriedAtSailingDay.toFixed(1)}`
              : "Not married"}
          </span>
        </p>
        <p><strong>Children</strong><span>{state.household.children.length} · not implemented</span></p>
        <p><strong>Inheritance</strong><span>{state.household.inheritance.designatedHeirId ? "Heir designated" : "No heir designated"}</span></p>
      </div>
      <p className="household-note">
        Marriage and household costs are gameplay abstractions, not a reconstruction
        of a specific late-17th-century Bengal custom. Children, aging, succession
        and inheritance rules are not active.
      </p>
    </section>
  );
}

function CityBuildingPanel({
  buildingId,
  state,
  onOpenMarket,
  onOpenDocks,
  onOpenMissions,
  onOpenBuilding,
  onBuyFarm,
  onCollectFarm,
  onBuyResidence,
  onMarry,
  onBuyWarehouse,
  onWarehouseTransfer,
  onTradeWithNpc,
  onClose,
}: {
  buildingId: CityBuildingId;
  state: GameState;
  onOpenMarket: () => void;
  onOpenDocks: () => void;
  onOpenMissions: () => void;
  onOpenBuilding: (buildingId: "home" | "warehouse" | "farm") => void;
  onBuyFarm: () => void;
  onCollectFarm: () => void;
  onBuyResidence: () => void;
  onMarry: () => void;
  onBuyWarehouse: () => void;
  onWarehouseTransfer: (good: GoodId, action: "store" | "retrieve") => void;
  onTradeWithNpc: (merchantId: string, goodId: GoodId) => void;
  onClose: () => void;
}) {
  const [inspectedMerchantId, setInspectedMerchantId] = useState<string | null>(null);
  const building = CITY_BUILDINGS.find((candidate) => candidate.id === buildingId)!;
  const town = getTown(state.currentTown);
  const ownsWarehouse = state.ownedWarehouses.includes(state.currentTown);
  const ownsFarm = state.ownedFarms.includes(state.currentTown);
  const ownsResidence = state.residenceTown === state.currentTown;
  const residenceTown = state.residenceTown
    ? getTown(state.residenceTown).name
    : null;
  const dockedMerchants = state.npcMerchants.filter(
    (merchant) =>
      merchant.phase === "docked" &&
      merchant.currentPort === state.currentTown,
  );
  const farmOutput = state.farmOutput[state.currentTown];
  const farmCargoSpace = getCargoCapacity(state) - getCargoUsed(state);
  const farmProgress = Math.min(
    1,
    Math.max(0, state.sailingDay - state.farmProductionDay[state.currentTown]),
  );
  const farmDaysUntilNext = Math.max(0, 1 - farmProgress);
  const action =
    buildingId === "market"
      ? onOpenMarket
      : buildingId === "docks"
        ? onOpenDocks
        : undefined;

  return (
    <section className="city-building-panel" aria-label={`${building.name} in ${town.name}`}>
      <header className="city-building-panel-heading">
        <div>
          <span className="eyebrow">{town.name} · TOWN BUILDING</span>
          <h2>{building.name}</h2>
        </div>
        <button className="drawer-close" aria-label="Close building details" onClick={onClose}>×</button>
      </header>
      {buildingId === "town" ? (
        <div className="town-centre-info" aria-label="Local standing and property">
          <section>
            <span className="eyebrow">LOCAL STATUS</span>
            <p>{state.visitedTowns.includes(state.currentTown) ? "Visited port" : "Not visited yet"}</p>
            <p>{state.reputation} global reputation · {state.localStanding[state.currentTown]}/100 local standing.</p>
            <p>Local standing has no access or price effects yet.</p>
          </section>
          <section
            className="npc-port-panel"
            aria-label={`Merchant traffic in ${town.name}`}
          >
            <span className="eyebrow">MERCHANT TRAFFIC</span>
            {dockedMerchants.length === 0 ? (
              <p>No named merchants docked here right now.</p>
            ) : (
              <div className="npc-port-list">
                {dockedMerchants.map((merchant) => {
                  const carriedGoods = CURRENT_MARKET_GOODS.filter(
                    (good) => merchant.cargo[good.id] > 0,
                  );
                  const inspected = inspectedMerchantId === merchant.id;
                  return (
                    <article className="npc-port-card" key={merchant.id}>
                      <div className="npc-port-card-heading">
                        <div>
                          <h3>{merchant.name}</h3>
                          <p>
                            Docked at {town.name} · cargo{" "}
                            {getCargoUsed({ ...state, cargo: merchant.cargo })}/
                            {merchant.cargoCapacity}
                          </p>
                        </div>
                        <button
                          className="npc-port-action"
                          aria-expanded={inspected}
                          onClick={() =>
                            setInspectedMerchantId(inspected ? null : merchant.id)
                          }
                        >
                          {inspected ? "Hide" : "Inspect"}
                        </button>
                      </div>
                      {inspected && (
                        <div className="npc-port-details">
                          <p>{getNpcTradingIntent(merchant)}</p>
                          <p>
                            Capital: {formatCoins(merchant.budget)} Coins · Goods carried:{" "}
                            {carriedGoods.length
                              ? carriedGoods
                                  .map(
                                    (good) =>
                                      `${good.name} × ${merchant.cargo[good.id]}`,
                                  )
                                  .join(", ")
                              : "none"}
                          </p>
                          {carriedGoods.map((good) => {
                            const price = getGoodPrice(
                              state.currentTown,
                              good.id,
                              "buy",
                              isHistoricalRouteAlertActive(state),
                              state.marketStock[state.currentTown][good.id],
                            );
                            return (
                              <button
                                className="npc-port-trade"
                                key={good.id}
                                disabled={
                                  state.coins < price ||
                                  getCargoUsed(state) >= getCargoCapacity(state)
                                }
                                onClick={() => onTradeWithNpc(merchant.id, good.id)}
                              >
                                Trade · Buy 1 {good.name} · {formatCoins(price)} Coins
                              </button>
                            );
                          })}
                          <button
                            className="npc-port-action npc-port-leave"
                            onClick={() => setInspectedMerchantId(null)}
                          >
                            Leave
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            {state.npcActivity
              .filter(
                (activity) =>
                  activity.town === state.currentTown &&
                  activity.message === "arrived",
              )
              .slice(-1)
              .map((activity) => (
                <p key={activity.id}>
                  {getNpcMerchant(state, activity.merchantId)?.name ?? "A merchant"} recently arrived.
                </p>
              ))}
          </section>
          <section>
            <span className="eyebrow">PROPERTY HERE</span>
            <ul aria-label={`Property in ${town.name}`}>
              {ownsWarehouse && <li>Warehouse</li>}
              {ownsFarm && <li>Farm</li>}
              {ownsResidence && <li>Residence</li>}
              {!ownsWarehouse && !ownsFarm && !ownsResidence && <li>No property owned here yet.</li>}
              {residenceTown && !ownsResidence && (
                <li>Your residence is in {residenceTown}.</li>
              )}
            </ul>
          </section>
          <div className="town-centre-actions">
            <button
              className="primary-button city-building-action"
              onClick={onOpenMissions}
            >
              <span>Open mission board</span>
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="primary-button city-building-action"
              onClick={() => onOpenBuilding("home")}
            >
              <span>{ownsResidence ? "Open your residence" : "View residence options"}</span>
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="town-centre-secondary city-building-action"
              onClick={() => onOpenBuilding("warehouse")}
            >
              <span>{ownsWarehouse ? "Open warehouse" : "View warehouse options"}</span>
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="town-centre-secondary city-building-action"
              onClick={() => onOpenBuilding("farm")}
            >
              <span>{ownsFarm ? "Open farm" : "View farm options"}</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : (
        <p>
          {buildingId === "warehouse"
            ? ownsWarehouse
              ? `Owned here · ${getWarehouseUsed(state, state.currentTown)}/${getWarehouseCapacity(state, state.currentTown)} storage spaces used. Your ship carries ${getCargoUsed(state)}/${getCargoCapacity(state)}.`
              : `No warehouse is owned here. Purchase one for ${formatCoins(WAREHOUSE_PRICE)} Coins to add ${WAREHOUSE_CAPACITY} local storage spaces.`
            : buildingId === "farm"
              ? ownsFarm
                ? `Owned here · ${state.farmOutput[state.currentTown]}/${FARM_OUTPUT_CAPACITY} Rice in local farm storage. Produces ${FARM_DAILY_OUTPUT} Rice per full in-game sailing day while the game is active.`
                : `No farm is owned here. Purchase one for ${formatCoins(FARM_PRICE)} Coins. It produces ${FARM_DAILY_OUTPUT} Rice per full in-game sailing day into its own local storage, up to ${FARM_OUTPUT_CAPACITY}.`
              : buildingId === "home"
                ? ownsResidence
                  ? "Your residence is established in this port. Ownership is saved; household and dynasty features are not included in this stage."
                  : residenceTown
                    ? `Your one residence is in ${residenceTown}. You cannot purchase an additional home in this stage.`
                    : `Establish your residence here for ${formatCoins(RESIDENCE_PRICE)} Coins. No reputation requirement applies; household features are not included in this stage.`
                : buildingId === "mosque"
                  ? "A shared place of worship in the town. This is a general game scene, not a reconstruction of a specific building."
                  : buildingId === "workshop"
                    ? "Town-specialised properties and remote management are planned, not playable yet."
                    : building.detail}
        </p>
      )}
      {buildingId === "home" && !state.residenceTown && (
        <button
          className="primary-button city-building-action"
          disabled={state.coins < RESIDENCE_PRICE}
          onClick={onBuyResidence}
        >
          <span>
            {state.coins < RESIDENCE_PRICE
              ? `Residence · ${formatCoins(RESIDENCE_PRICE)} Coins (need ${formatCoins(RESIDENCE_PRICE - state.coins)} more)`
              : `Establish residence · ${formatCoins(RESIDENCE_PRICE)} Coins`}
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}
      {buildingId === "home" && state.residenceTown === state.currentTown && (
        state.household.spouse ? (
          <div className="household-home-status">
            <p>Your household is established here.</p>
            <p>This relationship is a gameplay abstraction. No family progression is active.</p>
          </div>
        ) : (
          <div className="household-home-status">
            <p>Marriage requires your residence and {formatCoins(MARRIAGE_HOUSEHOLD_COST)} Coins to establish the household.</p>
            <p>This cost is a gameplay rule, not a historical ceremony fee.</p>
            <button
              className="primary-button city-building-action"
              disabled={state.coins < MARRIAGE_HOUSEHOLD_COST}
              onClick={onMarry}
            >
              <span>
                {state.coins < MARRIAGE_HOUSEHOLD_COST
                  ? `Establish household · ${formatCoins(MARRIAGE_HOUSEHOLD_COST)} Coins (need ${formatCoins(MARRIAGE_HOUSEHOLD_COST - state.coins)} more)`
                  : `Establish marriage · ${formatCoins(MARRIAGE_HOUSEHOLD_COST)} Coins`}
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )
      )}
      {buildingId === "home" && state.residenceTown && state.residenceTown !== state.currentTown && (
        <p>Your residence is in {residenceTown}. Marriage can only be established there.</p>
      )}
      {buildingId === "farm" && !ownsFarm && (
        <button
          className="primary-button city-building-action"
          disabled={state.coins < FARM_PRICE}
          onClick={onBuyFarm}
        >
          <span>
            {state.coins < FARM_PRICE
              ? `Farm · ${formatCoins(FARM_PRICE)} Coins (need ${formatCoins(FARM_PRICE - state.coins)} more)`
              : `Buy farm · ${formatCoins(FARM_PRICE)} Coins`}
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}
      {buildingId === "farm" && ownsFarm && (
        <div className="farm-output-panel" aria-label="Farm production and collection">
          <p>
            {farmOutput >= FARM_OUTPUT_CAPACITY
              ? "Storage is full. Further production is lost until you collect Rice."
              : `Next Rice in ${farmDaysUntilNext.toFixed(1)} in-game sailing days.`}
          </p>
          <p>Ship cargo: {state.cargo[FARM_GOOD_ID]} · {farmCargoSpace} free spaces.</p>
          <button
            className="primary-button city-building-action"
            disabled={farmOutput === 0 || farmCargoSpace === 0}
            onClick={onCollectFarm}
          >
            <span>
              {farmOutput === 0
                ? "No Rice ready to collect"
                : farmCargoSpace === 0
                  ? "Ship hold is full"
                  : `Collect up to ${Math.min(farmOutput, farmCargoSpace)} Rice`}
            </span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
      {buildingId === "warehouse" && (
        state.ownedWarehouses.includes(state.currentTown) ? (
          <div className="warehouse-good-list" aria-label="Warehouse inventory">
            {CURRENT_MARKET_GOODS.map((good) => {
              const stored = state.warehouseStock[state.currentTown][good.id];
              const carried = state.cargo[good.id];
              const cargoFull = getCargoUsed(state) >= getCargoCapacity(state);
              const warehouseFull =
                getWarehouseUsed(state, state.currentTown) >=
                getWarehouseCapacity(state, state.currentTown);
              return (
                <div className="warehouse-good-row" key={good.id}>
                  <span>{good.name}<small>Ship {carried} · Stored {stored}</small></span>
                  <button
                    aria-label={`Store one ${good.name}`}
                    disabled={carried === 0 || warehouseFull}
                    onClick={() => onWarehouseTransfer(good.id, "store")}
                  >Store</button>
                  <button
                    aria-label={`Retrieve one ${good.name}`}
                    disabled={stored === 0 || cargoFull}
                    onClick={() => onWarehouseTransfer(good.id, "retrieve")}
                  >Take</button>
                </div>
              );
            })}
          </div>
        ) : (
          <button
            className="primary-button city-building-action"
            disabled={state.coins < WAREHOUSE_PRICE}
            onClick={onBuyWarehouse}
          >
            <span>Buy warehouse · {formatCoins(WAREHOUSE_PRICE)} Coins</span>
            <span aria-hidden="true">→</span>
          </button>
        )
      )}
      {action && (
        <button className="primary-button city-building-action" onClick={action}>
          <span>{buildingId === "market" ? "Trade at the market" : "Open the shipyard"}</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </section>
  );
}

export default function App() {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [game, setGame] = useState<GameState | null>(null);
  const [savedGame, setSavedGame] = useState<GameState | null>(null);
  const [screen, setScreen] = useState<Screen>("map");
  const [cityEntered, setCityEntered] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<CityBuildingId | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [portPanelExpanded, setPortPanelExpanded] = useState(false);
  const [portPanelHeight, setPortPanelHeight] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveIsNewer, setSaveIsNewer] = useState(false);
  const [accountService] = useState(() => {
    const config = getOnlineConfig();
    return config ? createAccountService(config) : null;
  });
  const [accountStatus, setAccountStatus] = useState<AccountStatus>({ kind: "loading" });
  const gameRef = useRef<GameState | null>(null);
  gameRef.current = game;
  // Commands applied since the last save. They are written together with the game.
  const pendingCommands = useRef<RecordedCommand[]>([]);
  const nextSeq = useRef(1);
  const lastCommandAt = useRef(0);

  useEffect(() => accountService?.subscribe(setAccountStatus), [accountService]);

  useEffect(() => {
    let active = true;
    openGameSession()
      .then(({ game: saved, log, resumedVoyage }) => {
        if (!active) return;
        nextSeq.current = log?.nextSeq ?? 1;
        lastCommandAt.current = log?.lastAt ?? 0;
        if (resumedVoyage) {
          pendingCommands.current.push({
            seq: nextSeq.current++,
            at: resumedVoyage.at,
            command: { type: "resumeVoyage", pausedAt: resumedVoyage.pausedAt },
          });
          lastCommandAt.current = resumedVoyage.at;
        }
        gameRef.current = saved;
        setSavedGame(saved);
        setGame(saved);
        setSaveStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSaveIsNewer(error instanceof NewerSaveError);
        setSaveError(
          error instanceof Error ? error.message : "Your offline save could not be loaded.",
        );
        setSaveStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  // The only way player actions change the game. The state updates immediately and
  // the command joins the queue, whether or not there is a connection.
  const dispatch = useCallback((command: GameCommand): CommandResult | null => {
    const current = gameRef.current;
    if (!current) return null;
    const at = Math.max(
      Date.now(),
      lastCommandAt.current,
      current.voyage?.progressUpdatedAt ?? 0,
    );
    const result = applyCommand(current, command, at);
    if (result.status === "applied") {
      pendingCommands.current.push({ seq: nextSeq.current++, at, command });
      lastCommandAt.current = at;
      gameRef.current = result.state;
      setGame(result.state);
    }
    return result;
  }, []);

  const persistGame = useCallback((): Promise<void> => {
    const state = gameRef.current;
    if (!state) return Promise.resolve();
    const commands = pendingCommands.current;
    pendingCommands.current = [];
    return commitGame(state, commands).catch((error: unknown) => {
      pendingCommands.current = [...commands, ...pendingCommands.current];
      throw error;
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setNow(Date.now());
    }, 120);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!game?.voyage) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const timestamp = Date.now();
      setNow(timestamp);
      const current = gameRef.current;
      if (!current?.voyage || timestamp >= current.voyage.arrivalAt) return;
      const checkpointed = checkpointVoyageProgress(current, timestamp);
      gameRef.current = checkpointed;
      setGame(checkpointed);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [Boolean(game?.voyage)]);

  useEffect(() => {
    const checkpointAndSave = () => {
      const timestamp = Date.now();
      setNow(timestamp);
      const current = gameRef.current;
      if (!current) return;
      const stateToSave = current.voyage
        ? checkpointVoyageProgress(current, timestamp)
        : current;
      gameRef.current = stateToSave;
      if (stateToSave !== current) setGame(stateToSave);
      setSaveStatus("saving");
      persistGame()
        .then(() => setSaveStatus("saved"))
        .catch((error: unknown) => {
          setSaveError(
            error instanceof Error ? error.message : "Your latest progress could not be saved.",
          );
          setSaveStatus("error");
        });
    };
    const resumeFromPause = () => {
      if (document.visibilityState !== "visible") return;
      const timestamp = Date.now();
      setNow(timestamp);
      const current = gameRef.current;
      if (!current?.voyage) return;
      dispatch({ type: "resumeVoyage", pausedAt: current.voyage.progressUpdatedAt });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") checkpointAndSave();
      else resumeFromPause();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", checkpointAndSave);
    window.addEventListener("pageshow", resumeFromPause);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", checkpointAndSave);
      window.removeEventListener("pageshow", resumeFromPause);
    };
  }, [dispatch, persistGame]);

  useEffect(() => {
    if (
      !game?.voyage ||
      now < game.voyage.arrivalAt
    ) return;
    dispatch({ type: "arrive" });
  }, [game, now, dispatch]);

  useEffect(() => {
    if (!game || saveStatus === "loading") return;
    setSaveStatus("saving");
    const saveTimer = window.setTimeout(() => {
      persistGame()
        .then(() => setSaveStatus("saved"))
        .catch((error: unknown) => {
          setSaveError(
            error instanceof Error ? error.message : "Your latest progress could not be saved.",
          );
          setSaveStatus("error");
        });
    }, 180);
    return () => window.clearTimeout(saveTimer);
  }, [game, saveStatus === "loading", persistGame]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const startNewGame = useCallback((captain: string) => {
    const nextGame = createNewGame(captain);
    pendingCommands.current = [];
    nextSeq.current = 1;
    lastCommandAt.current = 0;
    gameRef.current = nextGame;
    setGame(nextGame);
    setSavedGame(nextGame);
    setScreen("map");
    setCityEntered(false);
    setSelectedBuilding(null);
    setNotice(`Welcome to Dhaka, ${nextGame.captainName}. Your little adventure begins!`);
    startCommandLog(nextGame).catch((error: unknown) => {
      setSaveError(
        error instanceof Error ? error.message : "Your latest progress could not be saved.",
      );
      setSaveStatus("error");
    });
  }, []);

  // Runs a command and shows the matching message. The interface hides docked-only
  // actions at sea, so "not-docked" here means a stale tap.
  const runCommand = useCallback(
    (command: GameCommand, messages: Record<string, string> = {}) => {
      const result = dispatch(command);
      if (!result) return null;
      if (result.status === "applied") {
        setNotice(result.state.lastMessage);
      } else if (result.status === "rejected") {
        setNotice(
          result.error === "not-docked"
            ? "Finish your voyage or encounter first."
            : (result.error && messages[result.error]) ?? result.message ?? "",
        );
      }
      return result;
    },
    [dispatch],
  );

  const handleBuy = useCallback(
    (good: GoodId, quantity: number) => {
      runCommand({ type: "buyGood", good, quantity }, {
        coins: "Not enough Coins yet. Try selling a good first.",
        space: "Your cargo hold is full. Sell something first.",
        "out-of-stock": "This stall has sold out. Try another port.",
      });
    },
    [runCommand],
  );

  const handleBuyPlayerShip = useCallback((vesselClass: VesselClassId) => {
    runCommand({ type: "buyShip", vesselClass }, {
      unavailable: "Ships can only be purchased while docked and clear of an encounter.",
      "not-shipyard": "New ships are available at Dhaka, Chittagong, and Hooghly.",
      "fleet-full": `You can own up to ${MAX_PLAYER_SHIPS} ships in this stage.`,
      coins: `A new ${VESSEL_CLASSES[vesselClass].name} costs ${formatCoins(VESSEL_CLASSES[vesselClass].price)} Coins.`,
    });
  }, [runCommand]);

  const handleSelectPlayerShip = useCallback(
    (shipId: string) => {
      runCommand({ type: "selectShip", shipId }, {
        unavailable: "Wait until your active ship has docked before switching ships.",
        "not-owned": "That ship is not part of your fleet.",
        "not-here": "Sail to that ship's port before managing it.",
        automated: "Pause or cancel this ship's automated route before managing it directly.",
        returning: "This ship is on its way back. Wait until it arrives.",
      });
    },
    [runCommand],
  );

  const handleReturnShip = useCallback(
    (shipId: string) => {
      runCommand({ type: "orderShipReturn", shipId }, {
        unavailable: "Resolve the current river encounter before ordering this ship back.",
        "no-route": "No river route is open for that ship right now. Try again later.",
        "not-owned": "That ship does not need a return order.",
        "not-needed": "That ship does not need a return order.",
      });
    },
    [runCommand],
  );

  const handleConfigureRoute = useCallback(
    (
      shipId: string,
      destination: TownId,
      rules: AutomatedTradeRule[],
      initialCapital: number,
    ) => {
      runCommand({ type: "configureRoute", shipId, destination, rules, initialCapital }, {
        unavailable: "Resolve the current river encounter before changing automated routes.",
        "not-owned": "That ship is not part of your fleet.",
        "active-ship": "The selected ship stays under your direct control; assign a different ship.",
        "not-docked": "Wait until the ship reaches a port before changing its route.",
        "port-not-visited": "Automated routes can use only ports you have visited.",
        "same-port": "Choose a different visited port for the other end of the route.",
        "no-route": "There is no open connected river route between those ports.",
        "too-large": "This ship is too large for the channels to that port.",
        "invalid-rules": "Choose at least one good to buy and one good to sell.",
        coins: "Your purse does not have enough Coins for that route capital.",
      });
    },
    [runCommand],
  );

  const handleAutomatedRouteStatus = useCallback(
    (shipId: string, status: "running" | "paused") => {
      runCommand({ type: "setRouteStatus", shipId, status }, {
        unavailable: "Resolve the current river encounter before changing route orders.",
        "not-assigned": "This ship has no automated route to change.",
        "not-docked": "Route orders can be changed only while the ship is docked.",
        "not-owned": "That ship is not part of your fleet.",
      });
    },
    [runCommand],
  );

  const handleCancelAutomatedRoute = useCallback(
    (shipId: string) => {
      runCommand({ type: "cancelRoute", shipId }, {
        unavailable: "Resolve the current river encounter before ending this route.",
        "not-assigned": "This ship has no automated route to cancel.",
        "not-docked": "A ship can leave its route only while docked.",
        "not-owned": "That ship is not part of your fleet.",
      });
    },
    [runCommand],
  );

  const handleNpcTrade = useCallback(
    (merchantId: string, good: GoodId) => {
      runCommand({ type: "tradeWithMerchant", merchantId, good }, {
        "not-at-port": "Dock at a port before trading with a merchant.",
        "not-present": "That merchant is no longer at this port.",
        "no-cargo": "That merchant no longer has this good to sell.",
        coins: "You do not have enough Coins for that trade.",
        space: "Your cargo hold is full; make room before trading.",
      });
    },
    [runCommand],
  );

  const handleSell = useCallback(
    (good: GoodId, quantity: number) => {
      runCommand({ type: "sellGood", good, quantity }, {
        empty: "You don't have any of that good to sell.",
        "market-full": "This stall cannot store any more of that good.",
      });
    },
    [runCommand],
  );

  const handleBuyWarehouse = useCallback(() => {
    runCommand({ type: "buyWarehouse" }, {
      coins: `A warehouse costs ${formatCoins(WAREHOUSE_PRICE)} Coins. Earn more before purchasing.`,
      "already-owned": "You already own a warehouse in this port.",
    });
  }, [runCommand]);

  const handleBuyResidence = useCallback(() => {
    runCommand({ type: "buyResidence" }, {
      coins: `A residence costs ${formatCoins(RESIDENCE_PRICE)} Coins. Earn more before purchasing.`,
      "already-owned": "You already have a residence in another port.",
    });
  }, [runCommand]);

  const handleBuyFarm = useCallback(() => {
    runCommand({ type: "buyFarm" }, {
      coins: `A farm costs ${formatCoins(FARM_PRICE)} Coins. Earn more before purchasing.`,
      "already-owned": "You already own a farm in this port.",
    });
  }, [runCommand]);

  const handleMarry = useCallback(() => {
    runCommand({ type: "marry" }, {
      "no-residence": "Establish a residence before starting a household.",
      "away-from-residence": "Return to your residence to establish a household.",
      "already-married": "Your household is already established.",
      coins: `Establishing a household costs ${formatCoins(MARRIAGE_HOUSEHOLD_COST)} Coins.`,
    });
  }, [runCommand]);

  const handleCollectFarm = useCallback(() => {
    runCommand({ type: "collectFarm" }, {
      "not-owned": "There is no farm here.",
      empty: "No Rice is ready to collect yet.",
      "cargo-full": "Your ship's hold is full.",
    });
  }, [runCommand]);

  const handleWarehouseTransfer = useCallback(
    (good: GoodId, action: "store" | "retrieve") => {
      runCommand({ type: action === "store" ? "storeGood" : "retrieveGood", good }, {
        "not-owned": "There is no warehouse here.",
        empty: action === "store"
          ? "You are not carrying any of that good."
          : "No units of that good are stored here.",
        full: "This warehouse has no free space.",
        "cargo-full": "Your ship's hold is full.",
      });
    },
    [runCommand],
  );

  const handleUpgrade = useCallback(
    (upgrade: UpgradeId) => {
      runCommand({ type: "buyUpgrade", upgrade }, {
        coins: "Save a few more Coins for this ship upgrade.",
        "max-level": "This upgrade is already at its best.",
        unavailable: "You can only upgrade while docked and clear of an encounter.",
      });
    },
    [runCommand],
  );

  const handleAcceptMission = useCallback(
    (missionId: string) => {
      runCommand({ type: "acceptMission", missionId }, {
        "not-at-board": "You must be docked to accept a contract.",
        "not-available": "That contract is no longer available at this port.",
        "active-limit": "Complete or expire an active contract before accepting another.",
      });
    },
    [runCommand],
  );

  if (saveStatus === "loading") return <LoadingScreen />;

  if (saveIsNewer) {
    return (
      <div className="game-background">
        <div className="save-error-banner" role="alert">
          <span>{saveError}</span>
          <button onClick={() => window.location.reload()}>Reload the game</button>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-background">
        {saveError && (
          <div className="save-error-banner" role="alert">
            <span>{saveError}</span>
            <button
              onClick={() => {
                void readRawSave().then((save) => downloadJson("bengal-trader-save.json", save));
              }}
            >
              Download a copy of your save
            </button>
            <button onClick={() => { setSaveError(""); setSaveStatus("ready"); }}>
              Start a fresh voyage (your old save is kept as a backup)
            </button>
          </div>
        )}
        <IntroScreen
          existingGame={savedGame}
          onContinue={() => {
            if (savedGame) {
              setGame(savedGame);
              setScreen("map");
            }
          }}
          onStart={startNewGame}
        />
      </div>
    );
  }

  const atDock = !game.voyage && !game.encounterPending;
  const cargoUsed = getCargoUsed(game);
  const town = getTown(game.currentTown);
  const currentDisplayYear = 1665 + Math.floor(game.sailingDay / 45);
  const isContextScreen =
    screen !== "map" && screen !== "city";
  const panelTitle: Record<Exclude<Screen, "map" | "city">, string> = {
    market: "Market",
    dock: "Docks",
    progress: "Reputation & goals",
    fleet: "Fleet",
    politics: "Politics",
    family: "Family",
    missions: "Mission board",
    properties: "Properties",
    notifications: "Notices",
    backups: "Save backups",
    account: "Account",
  };

  const closePanel = () => {
    setScreen(cityEntered ? "city" : "map");
    setSelectedBuilding(null);
    setMoreOpen(false);
  };

  const enterMap = () => {
    setCityEntered(false);
    setSelectedBuilding(null);
    setScreen("map");
    setMoreOpen(false);
  };

  const openCity = () => {
    if (!atDock) return;
    setCityEntered(true);
    setSelectedBuilding(null);
    setScreen("city");
    setMoreOpen(false);
  };

  const sailToSelectedPort = () => {
    const startedAt = Date.now();
    setNow(startedAt);
    setCityEntered(false);
    setSelectedBuilding(null);
    setScreen("map");
    const result = dispatch({ type: "startVoyage" });
    if (result?.state.voyage) {
      setNotice(`Your boat is sailing to ${getTown(result.state.voyage.destination).name}.`);
    } else if (result?.message) {
      setNotice(result.message);
    }
  };

  return (
    <div className="game-background">
      <main className="app-shell game-shell">
        <header className="game-header">
          <div className="game-brand">
            <div className="crest crest-small" aria-hidden="true">B</div>
            <div>
              <span className="brand-eyebrow">BENGAL · {currentDisplayYear}</span>
              <h1>The Bengal Trader</h1>
            </div>
          </div>
          <div className="quick-stats" aria-label={`Coins ${formatCoins(game.coins)}; cargo ${cargoUsed} of ${getCargoCapacity(game)}`}>
            <div className="quick-stat coins-stat">
              <CoinIcon />
              <span><span className="value-pulse" key={game.coins}>{formatCoinsCompact(game.coins)}</span><small>Coins</small></span>
            </div>
            <div className="quick-stat cargo-stat">
              <CargoMark />
              <span><span className="value-pulse" key={cargoUsed}>{cargoUsed}</span><small>/{getCargoCapacity(game)}</small></span>
            </div>
            <button
              aria-label={`Open reputation and milestones; ${game.reputation} reputation`}
              className="quick-stat reputation-stat"
              onClick={() => {
                setScreen("progress");
                setSelectedBuilding(null);
                setMoreOpen(false);
              }}
            >
              <span aria-hidden="true">✦</span>
              <span>{game.reputation}<small>rep</small></span>
            </button>
          </div>
        </header>

        <section className="captain-strip" aria-label="Your ship and current port">
          <span className="captain-port-dot" aria-hidden="true" />
          <span>
            {game.voyage
              ? `${game.voyage.route.legs.length > 1 ? "Under way" : "At sea"} · heading to ${getTown(game.voyage.destination).name}`
              : game.encounterPending
                ? `Chittagong waters · ${game.fleet.find((ship) => ship.id === game.selectedShipId)?.name}`
                : `${town.name} · ${game.fleet.find((ship) => ship.id === game.selectedShipId)?.name}`}
          </span>
          <span className={`save-indicator save-${saveStatus}`} aria-live="polite">
            <i aria-hidden="true" />
            {saveStatus === "error" ? "Save issue" : saveStatus === "saving" ? "Saving" : "Saved"}
          </span>
        </section>

        {saveError && saveStatus === "error" && (
          <div className="save-error-banner" role="alert">
            <span>{saveError}</span>
            <button onClick={() => {
              setSaveError("");
              setSaveStatus("saving");
              persistGame()
                .then(() => setSaveStatus("saved"))
                .catch((error: unknown) => {
                  setSaveError(error instanceof Error ? error.message : "Could not save your voyage.");
                  setSaveStatus("error");
                });
            }}>
              Try again
            </button>
          </div>
        )}

        {notice && (
          <div className="notice-banner" role="status">
            <span>{notice}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button>
          </div>
        )}

        <section className="game-world" aria-label={cityEntered ? `${town.name} city` : "Bengal world map"}>
          {cityEntered && (
            <CityScene
              townName={town.name}
              selectedBuilding={selectedBuilding}
              onSelectBuilding={(building) => {
                if (!atDock) return;
                setSelectedBuilding(building);
                setMoreOpen(false);
                if (building === "market") setScreen("market");
                else if (building === "docks") setScreen("dock");
                else setScreen("city");
              }}
            />
          )}
          {/* Stays mounted in town: rebuilding it would lose the camera and reload its art. */}
          <BengalMap
            hidden={cityEntered}
            bottomInset={portPanelHeight}
            state={game}
            now={now}
            onSelectTown={(destination: TownId) => {
              if (!atDock) return;
              setSelectedBuilding(null);
              setMoreOpen(false);
              setScreen("map");
              dispatch({ type: "selectDestination", town: destination });
            }}
          />

          {screen === "map" && !game.voyage && !game.encounterPending && (
            <PortContextPanel
              expanded={portPanelExpanded}
              onToggle={() => setPortPanelExpanded((open) => !open)}
              onHeightChange={setPortPanelHeight}
              state={game}
              onEnterCity={openCity}
              onTravel={sailToSelectedPort}
            />
          )}

          {screen === "map" && (game.voyage || game.encounterPending) && (
            <VoyagePanel
              now={now}
              onSpeedChange={(speed) => dispatch({ type: "changeVoyageSpeed", speed })}
              onDefend={() => {
                const result = dispatch({ type: "resolveEncounter" });
                if (result?.encounter) setNotice(result.encounter.message);
              }}
              onSail={sailToSelectedPort}
              state={game}
            />
          )}

          {screen === "map" && game.voyage?.routeAlert && (
            <div className="route-event-alert" role="status">
              <span className="route-event-mark" aria-hidden="true">!</span>
              <div>
                <strong>Chittagong's routes are busier than usual.</strong>
                <p>A fictional delay adds up to one in-game day, with every journey capped at five minutes.</p>
              </div>
            </div>
          )}

          {screen === "map" && game.shipHull <= 3 && !game.encounterPending && !game.voyage && (
            <div className="low-hull-alert" role="status">
              Your ship is battered. Visit the docks for repairs before sailing.
            </div>
          )}

          {isContextScreen && (
            <section
              className={`context-drawer${screen === "market" ? " context-drawer-market" : ""}`}
              aria-label={`${panelTitle[screen]} panel`}
            >
              <header className="drawer-heading">
                <div>
                  <span className="eyebrow">{cityEntered ? `${town.name} · CITY` : `${town.name} · PORT`}</span>
                  <h2>{panelTitle[screen]}</h2>
                </div>
                <button className="drawer-close" aria-label="Close panel" onClick={closePanel}>×</button>
              </header>
              {screen === "market" && (
                <MarketPanel state={game} onBuy={handleBuy} onSell={handleSell} />
              )}
              {screen === "dock" && (
                <DockPanel
                  onRepair={() => {
                    runCommand({ type: "repairShip" }, {
                      coins: "Earn a few more Coins before repairing your ship.",
                      unavailable: "You can only repair while docked and clear of an encounter.",
                    });
                  }}
                  onUpgrade={handleUpgrade}
                  state={game}
                  onBuyShip={handleBuyPlayerShip}
                />
              )}
              {screen === "progress" && <ProgressPanel state={game} />}
              {screen === "family" && <HouseholdPanel state={game} />}
              {screen === "backups" && (
                <SaveBackupPanel onRestored={() => window.location.reload()} />
              )}
              {screen === "account" && accountService && (
                <AccountPanel service={accountService} status={accountStatus} />
              )}
              {screen === "missions" && (
                <MissionBoardPanel state={game} onAccept={handleAcceptMission} />
              )}
              {(screen === "fleet" ||
                screen === "politics" ||
                screen === "properties" ||
                screen === "notifications") && (
                <FutureSystemsPanel
                  screen={screen}
                  state={game}
                  onSelectShip={handleSelectPlayerShip}
                  onReturnShip={handleReturnShip}
                  onConfigureRoute={handleConfigureRoute}
                  onRouteStatus={handleAutomatedRouteStatus}
                  onCancelRoute={handleCancelAutomatedRoute}
                />
              )}
              {screen === "notifications" && (
                <HistoricalEventCard state={game} />
              )}
            </section>
          )}

          {cityEntered && screen === "city" && selectedBuilding && (
            <CityBuildingPanel
              buildingId={selectedBuilding}
              state={game}
              onOpenMarket={() => setScreen("market")}
              onOpenDocks={() => setScreen("dock")}
              onOpenMissions={() => setScreen("missions")}
              onOpenBuilding={(buildingId) => setSelectedBuilding(buildingId)}
              onBuyFarm={handleBuyFarm}
              onCollectFarm={handleCollectFarm}
              onBuyResidence={handleBuyResidence}
              onMarry={handleMarry}
              onBuyWarehouse={handleBuyWarehouse}
              onWarehouseTransfer={handleWarehouseTransfer}
              onTradeWithNpc={handleNpcTrade}
              onClose={() => setSelectedBuilding(null)}
            />
          )}

          {moreOpen && (
            <nav className="more-menu" aria-label="More game areas">
              <button
                className="mobile-more-option"
                aria-label={`Open ${town.name} mission board`}
                disabled={!atDock}
                onClick={() => {
                  setScreen("missions");
                  setSelectedBuilding(null);
                  setMoreOpen(false);
                }}
              >
                Mission board · {town.name}
              </button>
              <button
                className="mobile-more-option"
                aria-label="Open reputation and milestones"
                onClick={() => {
                  setScreen("progress");
                  setSelectedBuilding(null);
                  setMoreOpen(false);
                }}
              >
                Reputation & goals
              </button>
              <button
                className="mobile-more-option"
                aria-label="Open fleet"
                onClick={() => {
                  setScreen("fleet");
                  setMoreOpen(false);
                }}
              >
                Fleet
              </button>
              <button
                className="mobile-more-option"
                aria-label="Open ship dock"
                disabled={!atDock}
                onClick={() => {
                  setScreen("dock");
                  setSelectedBuilding(null);
                  setMoreOpen(false);
                }}
              >
                Docks
              </button>
              {([
                ["politics", "Politics"],
                ["family", "Household"],
                ["properties", "Properties"],
                ["notifications", "Notifications"],
                ["backups", "Save backups"],
                ...(accountService ? ([["account", "Account"]] as const) : []),
              ] as const).map(([destination, label]) => (
                <button
                  key={destination}
                  onClick={() => {
                    setScreen(destination);
                    setMoreOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
              <p className="more-menu-version">
                Version {APP_VERSION} ·{" "}
                <a href={getProblemReportUrl()} target="_blank" rel="noreferrer">
                  Report a problem
                </a>
              </p>
            </nav>
          )}
        </section>

        <nav className="game-navigation" aria-label="Game navigation">
          <button
            aria-current={screen === "map" && !cityEntered ? "page" : undefined}
            aria-label="Open map"
            className={`game-nav-button${screen === "map" && !cityEntered ? " game-nav-active" : ""}`}
            onClick={enterMap}
          >
            <PortIcon kind="map" /><span>Map</span>
          </button>
          <button
            aria-current={cityEntered ? "page" : undefined}
            aria-label={`Enter ${town.name} city`}
            className={`game-nav-button${cityEntered ? " game-nav-active" : ""}`}
            disabled={!atDock}
            onClick={openCity}
          >
            <PortIcon kind="city" /><span>City</span>
          </button>
          <button
            aria-current={screen === "fleet" ? "page" : undefined}
            aria-label="Open fleet"
            className={`game-nav-button${screen === "fleet" ? " game-nav-active" : ""}`}
            onClick={() => { setScreen("fleet"); setMoreOpen(false); }}
          >
            <PortIcon kind="fleet" /><span>Fleet</span>
          </button>
          <button
            aria-label={`Open ${town.name} market`}
            aria-current={screen === "market" ? "page" : undefined}
            className={`game-nav-button${screen === "market" ? " game-nav-active" : ""}`}
            disabled={!atDock}
            onClick={() => { setScreen("market"); setSelectedBuilding(null); setMoreOpen(false); }}
          >
            <PortIcon kind="market" /><span>Trade</span>
          </button>
          <button
            aria-current={screen === "dock" ? "page" : undefined}
            aria-label="Open ship dock"
            className={`game-nav-button${screen === "dock" ? " game-nav-active" : ""}`}
            disabled={!atDock}
            onClick={() => { setScreen("dock"); setSelectedBuilding(null); setMoreOpen(false); }}
          >
            <PortIcon kind="dock" /><span>Docks</span>
          </button>
          <button
            aria-expanded={moreOpen}
            aria-label="Open more game areas"
            className={`game-nav-button${moreOpen ? " game-nav-active" : ""}`}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <PortIcon kind="more" /><span>More</span>
          </button>
        </nav>

        <footer className="game-footer">
          <span>{cityEntered ? `VISITING ${town.name.toUpperCase()}` : "YOUR FAMILY'S STORY IS JUST BEGINNING"}</span>
          <span aria-label="Offline save is ready" title="Saved on this device">◆</span>
        </footer>
      </main>
    </div>
  );
}
