import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BengalMap from "./components/BengalMap";
import CityScene, {
  CITY_BUILDINGS,
  type CityBuildingId,
} from "./components/CityScene";
import {
  CURRENT_MARKET_GOODS,
  MARKET_MAX_STOCK,
  UPGRADES,
  ADDITIONAL_SHIP_PRICE,
  MAX_AUTOMATED_ROUTE_CAPITAL,
  MAX_PLAYER_SHIPS,
  SHIPYARD_PORTS,
  acceptMission,
  arriveAtDestination,
  buyGood,
  buyPlayerShip,
  cancelAutomatedTradeRoute,
  configureAutomatedTradeRoute,
  buyFarm,
  buyResidence,
  buyWarehouse,
  buyUpgrade,
  checkpointVoyageProgress,
  changeVoyageSpeed,
  collectFarmOutput,
  createNewGame,
  getCargoCapacity,
  getCargoUsed,
  getWarehouseCapacity,
  getWarehouseUsed,
  marryAtResidence,
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
  getShipMaximumHull,
  getTown,
  getTownRoute,
  getNpcMerchant,
  getNpcTradingIntent,
  isHistoricalRouteAlertActive,
  repairShip,
  RESIDENCE_PRICE,
  resolveRiverEncounter,
  resumeVoyage,
  sellGood,
  selectPlayerShip,
  setAutomatedTradeRouteStatus,
  storeGoodInWarehouse,
  retrieveGoodFromWarehouse,
  tradeWithNpcMerchant,
  startVoyage,
  WAREHOUSE_CAPACITY,
  WAREHOUSE_PRICE,
  type GameState,
  type AutomatedTradeRule,
  type GoodId,
  type Mission,
  type PlayerShip,
  type Screen,
  type TownId,
  type UpgradeId,
  type WarehouseTransferError,
} from "./game/model";
import { loadGame, saveGame } from "./game/storage";
import {
  formatInGameDays,
  formatTravelDuration,
  getRouteTravelTime,
  getVoyageProgressMs,
  getVoyageRemainingRealTimeMs,
  SAILING_SPEEDS,
  type SailingSpeed,
} from "./game/travel-time";

type SaveStatus = "loading" | "ready" | "saved" | "saving" | "error";

function GoldCoin() {
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
  return (
    <svg className="good-illustration" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      {good === "rice" && (
        <>
          <path d="M9 42q19-7 36 0L42 49H14Z" fill="#9b6343" stroke="#744932" strokeWidth="1.5" />
          <path d="M13 40q15-9 30 0M16 37q12-8 24 0" fill="#e2bb79" stroke="#ab8151" strokeWidth="1.3" />
          <path d="M26 37q-8-11-3-24m6 24q9-12 5-23m-8 12q-10-6-10-12m12 6q9-4 11-11" stroke="#69784c" strokeWidth="1.8" strokeLinecap="round" />
          <path d="m17 11 5 2m12-2-5 3m-12-8 4 3m16-2-4 3m-10-10 3 5" stroke="#d7ad68" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {good === "muslin" && (
        <>
          <path d="m12 16 9 2 7-5 8 5-2 19q-9 5-20-1Z" fill="#e5d6b1" stroke="#a9936b" strokeWidth="1.5" />
          <path d="m12 16 8-7 8 4 8-4 5 8-9 1-4-4-8 5Z" fill="#f3e8cd" stroke="#a9936b" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="m19 21 5 1m-4 4 13-1m-12 6 12-1" stroke="#d0bc95" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M17 9q4-6 8 0m3 4q4-5 8 0" stroke="#9d8259" strokeWidth="1.3" strokeLinecap="round" />
        </>
      )}
      {good === "salt" && (
        <>
          <path d="m12 38 6-14 8 2 7-13 9 13-3 15-12 3Z" fill="#f2ead8" stroke="#b6ae9b" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="m19 24 7 2 7-13m-11 20 9 1m-3-7 10 2" stroke="#fffdf3" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 45h28M20 49h17" stroke="#9d8259" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {good === "silk" && (
        <>
          <path d="M17 16q0-7 11-9 11 2 11 9v20q0 7-11 9-11-2-11-9Z" fill="#d9b36c" stroke="#987548" strokeWidth="1.5" />
          <path d="M17 17q11 6 22 0m-22 6q11 6 22 0m-22 6q11 6 22 0m-22 6q11 6 22 0m-19 8q8-5 16 0" stroke="#f2dfa9" strokeWidth="1.5" />
        </>
      )}
      {good === "sugar" && (
        <>
          <path d="M14 44 24 10m8 36 2-36m-12 21 13-7m-17 1 11-8m-8 22 15-8m-10 5 10 5" stroke="#71814d" strokeWidth="3" strokeLinecap="round" />
          <path d="M12 45h32l-4 5H16Z" fill="#c99558" stroke="#87603f" strokeWidth="1.4" />
          <path d="M18 44q9-8 20 0" fill="#e1c181" stroke="#b28850" strokeWidth="1.3" />
        </>
      )}
      {good === "saltpetre" && (
        <>
          <path d="m11 40 7-14 8 4 5-18 15 24-7 8-14 1Z" fill="#eee7d7" stroke="#9e9c8b" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="m18 27 8 3 5-18m-8 27 15-2m-5-13 9 10" stroke="#fffdf3" strokeWidth="2" strokeLinecap="round" />
          <path d="M13 48h32" stroke="#9d8259" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      {good === "opium" && (
        <>
          <path d="M28 43V23m0 8Q18 19 13 27q2 9 15 8m0-4q10-14 17-6-3 9-17 10" fill="none" stroke="#65794d" strokeWidth="2" strokeLinecap="round" />
          <path d="M28 24q-12-5-8-13 7-1 8 7 2-9 9-7 3 8-9 13Z" fill="#b77c73" stroke="#82584f" strokeWidth="1.4" />
          <circle cx="28" cy="24" r="3" fill="#d9b466" />
          <path d="M21 45h14l-2 5h-10Z" fill="#9b6946" stroke="#75513c" strokeWidth="1.2" />
        </>
      )}
      {good === "lac" && (
        <>
          <path d="M18 18h20l-2 6 5 20q-12 7-26 0l5-20Z" fill="#a84e3e" stroke="#703d34" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M20 24h16m-14 5q8 4 14 0m-15 7q7 4 15 0" stroke="#d89160" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M20 18q8-5 16 0" stroke="#e4bd7a" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      <path d="M6 48q5-3 9 0m25-3q4-3 9-1" stroke="#68805b" strokeWidth="1.5" strokeLinecap="round" />
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
          <p className="cover-story">Five river towns. One little boat.<br />A big adventure ahead.</p>
        </div>
        <div className="cover-ship" aria-hidden="true">
          <svg viewBox="0 0 240 102" fill="none">
            <path d="M37 69h160l-20 23q-62 13-120 0Z" fill="#543b2c" stroke="#342a25" strokeWidth="3" />
            <path d="M48 73h134l-12 11H57Z" fill="#ae7149" />
            <path d="M111 12v59M108 18v41L52 59Zm10 5v37l48 0Z" fill="#f5ead0" stroke="#9b805b" strokeWidth="2" />
            <path d="M67 68h22m62 0h19" stroke="#f1ddba" strokeWidth="4" strokeLinecap="round" />
            <path d="M16 96q17-6 31 1t30 0m86 3q25-7 46 0t35-1" stroke="#e8e1c3" strokeWidth="3" strokeLinecap="round" opacity=".8" />
            <circle cx="43" cy="34" r="3" fill="#eddaa6" />
            <circle cx="197" cy="42" r="2" fill="#eddaa6" />
          </svg>
        </div>
        <div className="cover-side-note" aria-hidden="true">RIVERS OF BENGAL</div>
      </div>

      <section className="intro-join">
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
  const selectedRoute = getTownRoute(
    state.currentTown,
    state.selectedTown,
    state.navigationConditions,
  );
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
  const historicalAlert = isHistoricalRouteAlertActive(state);
  const selectedIsCurrent = currentPort.id === nextPort.id;
  const selectedRouteTime = selectedRoute
    ? getRouteTravelTime(
        selectedRoute,
        nextPort.id === "chittagong" && historicalAlert,
      )
    : null;

  return (
    <>
      {voyage ? (
        <section className="voyage-card underway-card" aria-live="polite">
          <div className="route-heading">
            <div className="route-emblem">⌁</div>
            <div>
              <span className="eyebrow">RIVER VOYAGE</span>
              <h2>To {getTown(voyage.destination).name}</h2>
            </div>
            <span className="remaining-time">{routeTime}</span>
          </div>
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
          <p className="voyage-note">Keep an eye on the river. You'll dock there soon.</p>
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
            <span>Ship strength <strong>{state.shipHull}/{8 + state.upgrades.hull * 3}</strong></span>
          </div>
          <button className="primary-button fight-button" onClick={onDefend}>
            <span>Protect the cargo</span><span aria-hidden="true">→</span>
          </button>
        </section>
      ) : (
        <section className="voyage-card voyage-ready">
          <div className="route-heading">
            <div className="route-emblem">⌁</div>
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
                ? `${currentPort.name} to ${nextPort.name}, following a direct waterway route.`
                : `The river path to ${nextPort.name} is blocked. Choose another port.`}
          </p>
          <button
            className="primary-button sail-button"
            disabled={selectedIsCurrent || !selectedRoute}
            onClick={onSail}
          >
            <span>{selectedIsCurrent ? "Choose a town on the map" : selectedRoute ? `Travel to ${nextPort.name}` : "No open river path"}</span>
            <span aria-hidden="true">→</span>
          </button>
          {!selectedIsCurrent && (
            <div className="ship-status">
              <span>Hull strength <strong>{state.shipHull}/{8 + state.upgrades.hull * 3}</strong></span>
              <span className="ship-status-bar"><i style={{ width: `${Math.min(100, (state.shipHull / (8 + state.upgrades.hull * 3)) * 100)}%` }} /></span>
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
  const formatGold = (amount: number) =>
    `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(amount)}g`;

  return (
    <section className="feature-panel" aria-label={`Market at ${getTown(state.currentTown).name}`}>
      <div className="feature-heading">
        <span className="eyebrow">THE BUSY QUAYSIDE</span>
        <h2>Market at {getTown(state.currentTown).name}</h2>
        <p>
          Local prices reflect supply, demand and stall stock. Each full sailing
          day moves stalls one item toward their usual stock.
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
        <strong>{state.gold} gold <span>· {cargoUsed}/{cargoLimit} hold</span></strong>
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
            buyQuote!.total <= state.gold;
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
                  <span>Buy {formatGold(buyPrice)} · Sell {formatGold(sellPrice)}</span>
                  <span className="market-stock-line">
                    Stall {marketStock} available · You hold {owned}
                  </span>
                  {owned > 0 && (
                    <span className={`inventory-return${estimatedProfit >= 0 ? " return-positive" : " return-negative"}`}>
                      Avg cost {formatGold(averageCost)} · Sell est. {formatGold(estimatedSellingValue)} ({estimatedProfit >= 0 ? "+" : ""}{formatGold(estimatedProfit)})
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
                    aria-label={`Buy ${good.name} for ${buyPrice} gold`}
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
                    aria-label={`Sell ${good.name} for ${sellPrice} gold`}
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
                    <strong>{formatGold(pendingQuote.total)}</strong>?
                  </p>
                  <div>
                    <button
                      className="trade-confirm-button"
                      disabled={
                        pendingTrade.action === "buy"
                          ? pendingQuote.total > state.gold ||
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
                      Confirm {pendingTrade.action} · {formatGold(pendingQuote.total)}
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

function DockPanel({
  state,
  onUpgrade,
  onRepair,
  onBuyShip,
}: {
  state: GameState;
  onUpgrade: (upgrade: UpgradeId) => void;
  onRepair: () => void;
  onBuyShip: () => void;
}) {
  const [confirmingShipPurchase, setConfirmingShipPurchase] = useState(false);
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
  const repairCost = hullToRepair * 2;

  return (
    <section className="feature-panel dock-panel" aria-label="Shipyard and dock">
      <div className="feature-heading dock-heading">
        <span className="eyebrow">SHIPYARD · {getTown(state.currentTown).name}</span>
        <h2>Shipyard repairs & upgrades</h2>
        <p>Repair for 2 gold per missing hull. Upgrade costs and new stats are shown before fitting.</p>
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
                      ? `Defence ${stats.defence} → ${stats.defence + 1} · Hull ${state.shipHull}/${maximumHull} → ${state.shipHull + (level === 0 ? 2 : 1)}/${maximumHull + 3}`
                      : `Hold ${stats.hold} → ${stats.hold + 6} spaces`}
                </span>
                <span className="upgrade-cost">Next fit · {price} gold</span>
              </div>
              <button
                aria-label={
                  maxed
                    ? `${upgrade.name} fully upgraded`
                    : `Upgrade ${upgrade.name} for ${price} gold`
                }
                className="upgrade-buy"
                disabled={
                  maxed ||
                  state.gold < price ||
                  Boolean(state.voyage) ||
                  state.encounterPending
                }
                onClick={() => onUpgrade(upgrade.id)}
              >
                {maxed ? <span>Done</span> : <><strong>{price}g</strong><span>Fit</span></>}
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
              ? `Restore ${hullToRepair} hull · ${repairCost} gold total (2 per hull).`
              : "Your ship is fully repaired."}
          </p>
        </div>
        <button
          aria-label={
            hullToRepair > 0
              ? `Repair ship for ${repairCost} gold`
              : "Ship fully repaired"
          }
          className="repair-button"
          disabled={
            hullToRepair === 0 ||
            state.gold < repairCost ||
            Boolean(state.voyage) ||
            state.encounterPending
          }
          onClick={onRepair}
        >
          {hullToRepair === 0
            ? "Fully repaired"
            : state.gold < repairCost
              ? `Need ${repairCost}g`
              : `Repair · ${repairCost}g`}
        </button>
      </div>
      <div className="ship-purchase-panel">
        <div>
          <strong>Buy another river boat</strong>
          <p>
            {SHIPYARD_PORTS.includes(state.currentTown)
              ? `Available here for ${ADDITIONAL_SHIP_PRICE} gold. Each boat stays at its own port until you sail it.`
              : `Available at ${SHIPYARD_PORTS.map((port) => getTown(port).name).join(", ")}.`}
          </p>
          <span>{state.fleet.length}/{MAX_PLAYER_SHIPS} ships owned</span>
        </div>
        {confirmingShipPurchase ? (
          <div
            className="ship-purchase-confirmation"
            role="group"
            aria-label="Buy ship confirmation"
          >
            <p>Buy an empty new boat for {ADDITIONAL_SHIP_PRICE} gold?</p>
            <div>
              <button
                className="ship-buy-button"
                onClick={() => {
                  onBuyShip();
                  setConfirmingShipPurchase(false);
                }}
              >
                Confirm · {ADDITIONAL_SHIP_PRICE}g
              </button>
              <button
                className="ship-cancel-button"
                onClick={() => setConfirmingShipPurchase(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="ship-buy-button"
            disabled={
              !SHIPYARD_PORTS.includes(state.currentTown) ||
              state.fleet.length >= MAX_PLAYER_SHIPS ||
              state.gold < ADDITIONAL_SHIP_PRICE ||
              Boolean(state.voyage) ||
              state.encounterPending
            }
            onClick={() => setConfirmingShipPurchase(true)}
          >
            {state.fleet.length >= MAX_PLAYER_SHIPS
              ? "Fleet full"
              : state.gold < ADDITIONAL_SHIP_PRICE
                ? `Need ${ADDITIONAL_SHIP_PRICE}g`
                : `Buy · ${ADDITIONAL_SHIP_PRICE}g`}
          </button>
        )}
      </div>
    </section>
  );
}

function PortContextPanel({
  state,
  onTravel,
  onEnterCity,
}: {
  state: GameState;
  onTravel: () => void;
  onEnterCity: () => void;
}) {
  const destination = getTown(state.selectedTown);
  const isHere = state.selectedTown === state.currentTown;
  const route = isHere
    ? null
    : getTownRoute(
        state.currentTown,
        state.selectedTown,
        state.navigationConditions,
      );
  const routeTime = route
    ? getRouteTravelTime(
        route,
        state.selectedTown === "chittagong" && isHistoricalRouteAlertActive(state),
      )
    : null;
  const dockedMerchants = state.npcMerchants.filter(
    (merchant) => merchant.phase === "docked" && merchant.currentPort === destination.id,
  );
  const recentPortActivity = state.npcActivity
    .filter((activity) => activity.town === destination.id)
    .at(-1);

  return (
    <section className="port-context-panel" aria-live="polite">
      <div className="port-context-copy">
        <span className="eyebrow">{isHere ? "YOUR CURRENT PORT" : "RIVER ROUTE"}</span>
        <h2>{destination.name}</h2>
        <p>
          {isHere
            ? "You are safely docked. Visit the town or get ready for your next voyage."
            : route
              ? routeTime
                ? `Direct waterway route · ${formatTravelDuration(routeTime.durationMs)} · ${formatInGameDays(routeTime.durationDays)} in-game days`
                : "A river section is closed. No safe water route is open right now."
              : "A river section is closed. No safe water route is open right now."}
        </p>
        <p className="npc-port-traffic">
          {dockedMerchants.length
            ? `At this port: ${dockedMerchants.map((merchant) => merchant.name).join(", ")}.`
            : "No NPC merchants are docked here right now."}
          {recentPortActivity
            ? ` Latest: ${getNpcMerchant(state, recentPortActivity.merchantId)?.name ?? "A merchant"} ${recentPortActivity.message}.`
            : ""}
        </p>
      </div>
      <button
        className="primary-button port-context-action"
        disabled={!isHere && !route}
        onClick={isHere ? onEnterCity : onTravel}
      >
        <span>{isHere ? "Enter city" : route ? `Travel to ${destination.name}` : "Route unavailable"}</span>
        <span aria-hidden="true">→</span>
      </button>
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
  const availableDestinations = state.visitedTowns.filter(
    (port) => port !== ship.currentPort,
  );
  const [editing, setEditing] = useState(false);
  const [destination, setDestination] = useState<string>(
    existingRoute?.destination !== ship.currentPort
      ? existingRoute?.destination ?? availableDestinations[0] ?? ""
      : availableDestinations[0] ?? "",
  );
  const [capital, setCapital] = useState("500");
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
      capitalAmount <= state.gold);
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
          <p>Route capital: {existingRoute.capital} gold</p>
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
            The ship starts at {getTown(ship.currentPort).name}. It trades one
            unit per selected good each sailing day and follows connected river
            routes. Route progress advances only while your voyage is active.
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
              <span>Starting trade capital (max {MAX_AUTOMATED_ROUTE_CAPITAL})</span>
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
              Editing keeps the current {existingRoute.capital} gold route capital.
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
              Your purse has {state.gold} gold. Starting capital is transferred
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
  onConfigureRoute,
  onRouteStatus,
  onCancelRoute,
}: {
  screen: Extract<Screen, "fleet" | "politics" | "family" | "properties" | "notifications">;
  state: GameState;
  onSelectShip: (shipId: string) => void;
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
              ship.currentPort === state.currentTown;
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
                  <div>
                    <h3>{ship.name}</h3>
                    <span>
                      {state.voyage?.shipId === ship.id
                        ? `At sea · to ${getTown(state.voyage.destination).name}`
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
                        : "Docked"}
                  </strong>
                </div>
                <div className="fleet-ship-stats">
                  <span>Hull {ship.shipHull}/{8 + ship.upgrades.hull * 3}</span>
                  <span>Cargo {cargoUsed}/{ship.cargoCapacity}</span>
                </div>
                {!isSelected && !ship.automatedRoute && (
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
                {!isSelected && (
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
  return `Earn ${mission.targetProfit} gold profit selling ${good} in ${destination}.`;
}

function missionProgressLabel(mission: Mission): string {
  if (mission.type === "delivery") {
    return `${mission.progress}/${mission.quantity} delivered`;
  }
  if (mission.type === "purchase_delivery") {
    return `${mission.purchasedQuantity}/${mission.quantity} bought · ${mission.progress}/${mission.quantity} delivered`;
  }
  if (mission.type === "visit") return `${mission.progress}/1 port visited`;
  return `${Math.floor(mission.progress)}/${mission.targetProfit} gold profit`;
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
          Reward: {mission.rewardGold} gold · +2 global reputation · +5 local standing in{" "}
          {getTown(mission.origin).name}
        </p>
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
                            Capital: {merchant.budget} gold · Goods carried:{" "}
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
                                  state.gold < price ||
                                  getCargoUsed(state) >= getCargoCapacity(state)
                                }
                                onClick={() => onTradeWithNpc(merchant.id, good.id)}
                              >
                                Trade · Buy 1 {good.name} · {price} gold
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
              : `No warehouse is owned here. Purchase one for ${WAREHOUSE_PRICE} gold to add ${WAREHOUSE_CAPACITY} local storage spaces.`
            : buildingId === "farm"
              ? ownsFarm
                ? `Owned here · ${state.farmOutput[state.currentTown]}/${FARM_OUTPUT_CAPACITY} Rice in local farm storage. Produces ${FARM_DAILY_OUTPUT} Rice per full in-game sailing day while the game is active.`
                : `No farm is owned here. Purchase one for ${FARM_PRICE} gold. It produces ${FARM_DAILY_OUTPUT} Rice per full in-game sailing day into its own local storage, up to ${FARM_OUTPUT_CAPACITY}.`
              : buildingId === "home"
                ? ownsResidence
                  ? "Your residence is established in this port. Ownership is saved; household and dynasty features are not included in this stage."
                  : residenceTown
                    ? `Your one residence is in ${residenceTown}. You cannot purchase an additional home in this stage.`
                    : `Establish your residence here for ${RESIDENCE_PRICE} gold. No reputation requirement applies; household features are not included in this stage.`
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
          disabled={state.gold < RESIDENCE_PRICE}
          onClick={onBuyResidence}
        >
          <span>
            {state.gold < RESIDENCE_PRICE
              ? `Residence · ${RESIDENCE_PRICE} gold (need ${RESIDENCE_PRICE - state.gold} more)`
              : `Establish residence · ${RESIDENCE_PRICE} gold`}
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
            <p>Marriage requires your residence and 100 gold to establish the household.</p>
            <p>This cost is a gameplay rule, not a historical ceremony fee.</p>
            <button
              className="primary-button city-building-action"
              disabled={state.gold < MARRIAGE_HOUSEHOLD_COST}
              onClick={onMarry}
            >
              <span>
                {state.gold < MARRIAGE_HOUSEHOLD_COST
                  ? `Establish household · ${MARRIAGE_HOUSEHOLD_COST} gold (need ${MARRIAGE_HOUSEHOLD_COST - state.gold} more)`
                  : `Establish marriage · ${MARRIAGE_HOUSEHOLD_COST} gold`}
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
          disabled={state.gold < FARM_PRICE}
          onClick={onBuyFarm}
        >
          <span>
            {state.gold < FARM_PRICE
              ? `Farm · ${FARM_PRICE} gold (need ${FARM_PRICE - state.gold} more)`
              : `Buy farm · ${FARM_PRICE} gold`}
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
            disabled={state.gold < WAREHOUSE_PRICE}
            onClick={onBuyWarehouse}
          >
            <span>Buy warehouse · {WAREHOUSE_PRICE} gold</span>
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
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const gameRef = useRef<GameState | null>(null);
  gameRef.current = game;

  useEffect(() => {
    let active = true;
    loadGame()
      .then((saved) => {
        if (!active) return;
        setSavedGame(saved);
        setGame(saved);
        setSaveStatus("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSaveError(
          error instanceof Error ? error.message : "Your offline save could not be loaded.",
        );
        setSaveStatus("error");
      });

    return () => {
      active = false;
    };
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
      saveGame(stateToSave)
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
      const resumed = resumeVoyage(current, timestamp);
      gameRef.current = resumed;
      setGame(resumed);
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
  }, []);

  useEffect(() => {
    if (
      !game?.voyage ||
      now < game.voyage.arrivalAt
    ) return;
    setGame((previous) =>
      previous?.voyage && now >= previous.voyage.arrivalAt
        ? arriveAtDestination(previous)
        : previous,
    );
  }, [game, now]);

  useEffect(() => {
    if (!game || saveStatus === "loading") return;
    setSaveStatus("saving");
    const saveTimer = window.setTimeout(() => {
      saveGame(game)
        .then(() => setSaveStatus("saved"))
        .catch((error: unknown) => {
          setSaveError(
            error instanceof Error ? error.message : "Your latest progress could not be saved.",
          );
          setSaveStatus("error");
        });
    }, 180);
    return () => window.clearTimeout(saveTimer);
  }, [game, saveStatus === "loading"]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const updateGame = useCallback((update: (state: GameState) => GameState) => {
    setGame((previous) => (previous ? update(previous) : previous));
  }, []);

  const startNewGame = useCallback((captain: string) => {
    const nextGame = createNewGame(captain);
    setGame(nextGame);
    setSavedGame(nextGame);
    setScreen("map");
    setCityEntered(false);
    setSelectedBuilding(null);
    setNotice(`Welcome to Dhaka, ${nextGame.captainName}. Your little adventure begins!`);
  }, []);

  const handleBuy = useCallback(
    (good: GoodId, quantity: number) => {
      updateGame((current) => {
        const trade = buyGood(current, good, quantity);
        if (trade.error === "gold") setNotice("Not enough gold yet. Try selling a good first.");
        if (trade.error === "space") setNotice("Your cargo hold is full. Sell something first.");
        if (trade.error === "out-of-stock") setNotice("This stall has sold out. Try another port.");
        if (!trade.error) setNotice(trade.state.lastMessage);
        return trade.state;
      });
    },
    [updateGame],
  );

  const handleBuyPlayerShip = useCallback(() => {
    updateGame((current) => {
      const result = buyPlayerShip(current);
      if (result.error === "unavailable") {
        setNotice("Ships can only be purchased while docked and clear of an encounter.");
      } else if (result.error === "not-shipyard") {
        setNotice("New ships are available at Dhaka, Chittagong, and Hooghly.");
      } else if (result.error === "fleet-full") {
        setNotice(`You can own up to ${MAX_PLAYER_SHIPS} ships in this stage.`);
      } else if (result.error === "gold") {
        setNotice(`A new river boat costs ${ADDITIONAL_SHIP_PRICE} gold.`);
      } else {
        setNotice(result.state.lastMessage);
      }
      return result.state;
    });
  }, [updateGame]);

  const handleSelectPlayerShip = useCallback(
    (shipId: string) => {
      updateGame((current) => {
        const result = selectPlayerShip(current, shipId);
        if (result.error === "unavailable") {
          setNotice("Wait until your active ship has docked before switching ships.");
        } else if (result.error === "not-owned") {
          setNotice("That ship is not part of your fleet.");
        } else if (result.error === "not-here") {
          setNotice("Sail to that ship's port before managing it.");
        } else if (result.error === "automated") {
          setNotice("Pause or cancel this ship's automated route before managing it directly.");
        } else if (result.state !== current) {
          setNotice(result.state.lastMessage);
        }
        return result.state;
      });
    },
    [updateGame],
  );

  const handleConfigureRoute = useCallback(
    (
      shipId: string,
      destination: TownId,
      rules: AutomatedTradeRule[],
      initialCapital: number,
    ) => {
      updateGame((current) => {
        const result = configureAutomatedTradeRoute(
          current,
          shipId,
          destination,
          rules,
          initialCapital,
        );
        const errorMessages: Record<
          NonNullable<typeof result.error>,
          string
        > = {
          unavailable: "Resolve the current river encounter before changing automated routes.",
          "not-owned": "That ship is not part of your fleet.",
          "active-ship": "The selected ship stays under your direct control; assign a different ship.",
          "not-docked": "Wait until the ship reaches a port before changing its route.",
          "port-not-visited": "Automated routes can use only ports you have visited.",
          "same-port": "Choose a different visited port for the other end of the route.",
          "no-route": "There is no open connected river route between those ports.",
          "invalid-rules": "Choose at least one good to buy and one good to sell.",
          gold: "Your purse does not have enough gold for that route capital.",
        };
        if (result.error) setNotice(errorMessages[result.error]);
        else setNotice(result.state.lastMessage);
        return result.state;
      });
    },
    [updateGame],
  );

  const handleAutomatedRouteStatus = useCallback(
    (shipId: string, status: "running" | "paused") => {
      updateGame((current) => {
        const result = setAutomatedTradeRouteStatus(current, shipId, status);
        if (result.error === "unavailable") {
          setNotice("Resolve the current river encounter before changing route orders.");
        } else if (result.error === "not-assigned") {
          setNotice("This ship has no automated route to change.");
        } else if (result.error === "not-docked") {
          setNotice("Route orders can be changed only while the ship is docked.");
        } else if (result.error) {
          setNotice("That ship is not part of your fleet.");
        } else {
          setNotice(result.state.lastMessage);
        }
        return result.state;
      });
    },
    [updateGame],
  );

  const handleCancelAutomatedRoute = useCallback(
    (shipId: string) => {
      updateGame((current) => {
        const result = cancelAutomatedTradeRoute(current, shipId);
        if (result.error === "unavailable") {
          setNotice("Resolve the current river encounter before ending this route.");
        } else if (result.error === "not-assigned") {
          setNotice("This ship has no automated route to cancel.");
        } else if (result.error === "not-docked") {
          setNotice("A ship can leave its route only while docked.");
        } else if (result.error) {
          setNotice("That ship is not part of your fleet.");
        } else {
          setNotice(result.state.lastMessage);
        }
        return result.state;
      });
    },
    [updateGame],
  );

  const handleNpcTrade = useCallback(
    (merchantId: string, goodId: GoodId) => {
      updateGame((current) => {
        const result = tradeWithNpcMerchant(current, merchantId, goodId);
        if (result.error === "not-at-port") {
          setNotice("Dock at a port before trading with a merchant.");
        } else if (result.error === "not-present") {
          setNotice("That merchant is no longer at this port.");
        } else if (result.error === "no-cargo") {
          setNotice("That merchant no longer has this good to sell.");
        } else if (result.error === "gold") {
          setNotice("You do not have enough gold for that trade.");
        } else if (result.error === "space") {
          setNotice("Your cargo hold is full; make room before trading.");
        } else {
          setNotice(result.state.lastMessage);
        }
        return result.state;
      });
    },
    [updateGame],
  );

  const handleSell = useCallback(
    (good: GoodId, quantity: number) => {
      updateGame((current) => {
        const trade = sellGood(current, good, quantity);
        if (trade.error === "empty") setNotice("You don't have any of that good to sell.");
        if (trade.error === "market-full") setNotice("This stall cannot store any more of that good.");
        if (!trade.error) setNotice(trade.state.lastMessage);
        return trade.state;
      });
    },
    [updateGame],
  );

  const handleBuyWarehouse = useCallback(() => {
    updateGame((current) => {
      const result = buyWarehouse(current);
      if (result.error === "gold") {
        setNotice(`A warehouse costs ${WAREHOUSE_PRICE} gold. Earn more before purchasing.`);
      } else if (result.error === "already-owned") {
        setNotice("You already own a warehouse in this port.");
      } else {
        setNotice(result.state.lastMessage);
      }
      return result.state;
    });
  }, [updateGame]);

  const handleBuyResidence = useCallback(() => {
    updateGame((current) => {
      const result = buyResidence(current);
      if (result.error === "gold") {
        setNotice(`A residence costs ${RESIDENCE_PRICE} gold. Earn more before purchasing.`);
      } else if (result.error === "already-owned") {
        setNotice("You already have a residence in another port.");
      } else {
        setNotice(result.state.lastMessage);
      }
      return result.state;
    });
  }, [updateGame]);

  const handleBuyFarm = useCallback(() => {
    updateGame((current) => {
      const result = buyFarm(current);
      if (result.error === "gold") {
        setNotice(`A farm costs ${FARM_PRICE} gold. Earn more before purchasing.`);
      } else if (result.error === "already-owned") {
        setNotice("You already own a farm in this port.");
      } else {
        setNotice(result.state.lastMessage);
      }
      return result.state;
    });
  }, [updateGame]);

  const handleMarry = useCallback(() => {
    updateGame((current) => {
      const result = marryAtResidence(current);
      if (result.error === "no-residence") {
        setNotice("Establish a residence before starting a household.");
      } else if (result.error === "away-from-residence") {
        setNotice("Return to your residence to establish a household.");
      } else if (result.error === "already-married") {
        setNotice("Your household is already established.");
      } else if (result.error === "gold") {
        setNotice(`Establishing a household costs ${MARRIAGE_HOUSEHOLD_COST} gold.`);
      } else {
        setNotice(result.state.lastMessage);
      }
      return result.state;
    });
  }, [updateGame]);

  const handleCollectFarm = useCallback(() => {
    updateGame((current) => {
      const result = collectFarmOutput(current);
      if (result.error === "not-owned") setNotice("There is no farm here.");
      else if (result.error === "empty") setNotice("No Rice is ready to collect yet.");
      else if (result.error === "cargo-full") setNotice("Your ship's hold is full.");
      else setNotice(result.state.lastMessage);
      return result.state;
    });
  }, [updateGame]);

  const handleWarehouseTransfer = useCallback(
    (good: GoodId, action: "store" | "retrieve") => {
      updateGame((current) => {
        const result = action === "store"
          ? storeGoodInWarehouse(current, good)
          : retrieveGoodFromWarehouse(current, good);
        const errorMessages: Record<WarehouseTransferError, string> = {
          "not-owned": "There is no warehouse here.",
          empty: action === "store"
            ? "You are not carrying any of that good."
            : "No units of that good are stored here.",
          full: "This warehouse has no free space.",
          "cargo-full": "Your ship's hold is full.",
        };
        if (result.error) setNotice(errorMessages[result.error]);
        else setNotice(result.state.lastMessage);
        return result.state;
      });
    },
    [updateGame],
  );

  const handleUpgrade = useCallback(
    (upgrade: UpgradeId) => {
      updateGame((current) => {
        const result = buyUpgrade(current, upgrade);
        if (result.error === "gold") setNotice("Save a little more gold for this ship upgrade.");
        if (result.error === "max-level") setNotice("This upgrade is already at its best.");
        if (result.error === "unavailable") setNotice("You can only upgrade while docked and clear of an encounter.");
        if (!result.error) setNotice(result.state.lastMessage);
        return result.state;
      });
    },
    [updateGame],
  );

  const handleAcceptMission = useCallback(
    (missionId: string) => {
      updateGame((current) => {
        const result = acceptMission(current, missionId);
        if (result.error === "not-at-board") {
          setNotice("You must be docked to accept a contract.");
        } else if (result.error === "not-available") {
          setNotice("That contract is no longer available at this port.");
        } else if (result.error === "active-limit") {
          setNotice("Complete or expire an active contract before accepting another.");
        } else {
          setNotice(result.state.lastMessage);
        }
        return result.state;
      });
    },
    [updateGame],
  );

  if (saveStatus === "loading") return <LoadingScreen />;

  if (!game) {
    return (
      <div className="game-background">
        {saveError && (
          <div className="save-error-banner" role="alert">
            <span>{saveError}</span>
            <button onClick={() => { setSaveError(""); setSaveStatus("ready"); }}>
              Start a fresh voyage
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
    updateGame((current) => {
      const next = startVoyage(current, startedAt);
      if (next.voyage) {
        setNotice(`Your boat is sailing to ${getTown(next.voyage.destination).name}.`);
      } else if (next.lastMessage) {
        setNotice(next.lastMessage);
      }
      return next;
    });
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
          <div className="quick-stats" aria-label={`Gold ${game.gold}; cargo ${cargoUsed} of ${getCargoCapacity(game)}`}>
            <div className="quick-stat gold-stat">
              <GoldCoin />
              <span>{game.gold}<small>gold</small></span>
            </div>
            <div className="quick-stat cargo-stat">
              <CargoMark />
              <span>{cargoUsed}<small>/{getCargoCapacity(game)}</small></span>
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
              ? `At sea · heading to ${getTown(game.voyage.destination).name}`
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
              saveGame(game)
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
          {cityEntered ? (
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
          ) : (
            <BengalMap
              state={game}
              now={now}
              onSelectTown={(destination: TownId) => {
                if (!atDock) return;
                setSelectedBuilding(null);
                setMoreOpen(false);
                setScreen("map");
                updateGame((current) => ({
                  ...current,
                  selectedTown: destination,
                  lastMessage: "",
                }));
              }}
            />
          )}

          {screen === "map" && !game.voyage && !game.encounterPending && (
            <PortContextPanel
              state={game}
              onEnterCity={openCity}
              onTravel={sailToSelectedPort}
            />
          )}

          {screen === "map" && (game.voyage || game.encounterPending) && (
            <VoyagePanel
              now={now}
              onSpeedChange={(speed) =>
                updateGame((current) =>
                  changeVoyageSpeed(current, speed, Date.now()),
                )
              }
              onDefend={() => {
                updateGame((current) => {
                  const encounter = resolveRiverEncounter(current);
                  setNotice(encounter.result.message);
                  return encounter.state;
                });
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
                    updateGame((current) => {
                      const repair = repairShip(current);
                      if (repair.error === "gold") setNotice("Earn a little more gold before repairing your ship.");
                      if (repair.error === "unavailable") setNotice("You can only repair while docked and clear of an encounter.");
                      if (!repair.error) setNotice(repair.state.lastMessage);
                      return repair.state;
                    });
                  }}
                  onUpgrade={handleUpgrade}
                  state={game}
                  onBuyShip={handleBuyPlayerShip}
                />
              )}
              {screen === "progress" && <ProgressPanel state={game} />}
              {screen === "family" && <HouseholdPanel state={game} />}
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
