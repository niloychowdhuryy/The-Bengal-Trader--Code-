import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  TOWNS,
  getTown,
  getSelectedVesselClass,
  getShipRoutePreview,
  getTownRoute,
  isHistoricalRouteAlertActive,
  type GameState,
  type TownId,
} from "../game/model";
import {
  pointAlongRiverRoute,
  riverPointsToSvgPath,
  type RiverRoute,
} from "../game/navigation";
import {
  formatTravelDuration,
  getRouteTravelTime,
  getVoyageProgressMs,
} from "../game/travel-time";
import BengalTradingVessel from "./map-art/BengalTradingVessel";

const NAVIGATION_MAP_WIDTH = 1152;
const MAP_HEIGHT = 768;
const MAP_WIDTH = 1365;
const NAVIGATION_TO_MAP_SCALE_X = MAP_WIDTH / NAVIGATION_MAP_WIDTH;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.7;
const DEFAULT_ASPECT_RATIO = MAP_WIDTH / MAP_HEIGHT;
const MOBILE_BREAKPOINT = "(max-width: 759px)";
const MOBILE_INITIAL_ZOOM = 1.5;
const MOBILE_INITIAL_FOCUS = {
  x: ((718 + 858) / 2) * NAVIGATION_TO_MAP_SCALE_X,
  y: (320 + 296) / 2,
};

interface MapCamera {
  x: number;
  y: number;
  zoom: number;
}

interface MapPointer {
  x: number;
  y: number;
}

type CameraGesture =
  | {
      kind: "drag";
      pointerId: number;
      start: MapPointer;
      camera: MapCamera;
    }
  | {
      kind: "pinch";
      distance: number;
      anchor: MapPointer;
      camera: MapCamera;
    };

function getCameraSize(zoom: number, aspectRatio: number): MapPointer {
  const baseHeight = Math.min(MAP_HEIGHT, MAP_WIDTH / aspectRatio);
  const height = baseHeight / zoom;
  return { x: height * aspectRatio, y: height };
}

function getMinimumZoom(aspectRatio: number): number {
  return Math.min(MIN_ZOOM, aspectRatio / DEFAULT_ASPECT_RATIO);
}

function clampCamera(camera: MapCamera, aspectRatio: number): MapCamera {
  const { x: width, y: height } = getCameraSize(camera.zoom, aspectRatio);
  const clampAxis = (position: number, size: number, mapSize: number) =>
    size >= mapSize
      ? (mapSize - size) / 2
      : Math.max(0, Math.min(mapSize - size, position));
  return {
    ...camera,
    x: clampAxis(camera.x, width, MAP_WIDTH),
    y: clampAxis(camera.y, height, MAP_HEIGHT),
  };
}

function cameraAtZoom(
  zoom: number,
  focus: MapPointer,
  focusFraction: MapPointer,
  aspectRatio: number,
): MapCamera {
  const nextZoom = Math.max(
    getMinimumZoom(aspectRatio),
    Math.min(MAX_ZOOM, zoom),
  );
  const { x: width, y: height } = getCameraSize(nextZoom, aspectRatio);
  return clampCamera({
    zoom: nextZoom,
    x: focus.x - focusFraction.x * width,
    y: focus.y - focusFraction.y * height,
  }, aspectRatio);
}

function pointerDistance(a: MapPointer, b: MapPointer): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getIsMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MOBILE_BREAKPOINT).matches
  );
}

interface BengalMapProps {
  state: GameState;
  now: number;
  onSelectTown: (town: TownId) => void;
  interactive?: boolean;
}

function getDisplayedRoute(state: GameState): RiverRoute | null {
  return state.voyage?.route ?? getShipRoutePreview(state, state.selectedTown).route;
}

export default function BengalMap({
  state,
  now,
  onSelectTown,
  interactive = true,
}: BengalMapProps) {
  const uniqueId = useId().replace(/:/g, "");
  const [camera, setCamera] = useState<MapCamera>({ x: 0, y: 0, zoom: 1 });
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const previousMobileViewport = useRef(isMobileViewport);
  const mapRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, MapPointer>());
  const gesture = useRef<CameraGesture | null>(null);
  const movedDuringGesture = useRef(false);
  const suppressClick = useRef(false);
  const route = getDisplayedRoute(state);
  const voyage = state.voyage;
  const progress = voyage
    ? Math.max(
        0,
        Math.min(
          1,
          getVoyageProgressMs(
            voyage,
            state.sailingSpeed,
            now,
          ) /
            voyage.durationMs,
        ),
      )
    : 0;
  const ship = voyage && route ? pointAlongRiverRoute(route, progress) : null;
  const routeIsDisplayed =
    Boolean(route) && (state.currentTown !== state.selectedTown || state.voyage !== null);
  const displayedRouteTime = route
    ? getRouteTravelTime(
        route,
        voyage?.routeAlert ??
          (state.selectedTown === "chittagong" &&
            isHistoricalRouteAlertActive(state)),
        getSelectedVesselClass(state).travelFactor,
      )
    : null;
  useEffect(() => {
      if (typeof window.matchMedia !== "function") return;
      const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT);
      const updateViewportMode = () => setIsMobileViewport(mediaQuery.matches);
      updateViewportMode();
      mediaQuery.addEventListener("change", updateViewportMode);
      return () => mediaQuery.removeEventListener("change", updateViewportMode);
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const updateAspectRatio = () => {
      const { width, height } = map.getBoundingClientRect();
      if (width > 0 && height > 0) setAspectRatio(width / height);
    };
    updateAspectRatio();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateAspectRatio);
    observer.observe(map);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const enteredDesktop = previousMobileViewport.current && !isMobileViewport;
    previousMobileViewport.current = isMobileViewport;
    if (isMobileViewport) {
      const zoom = Math.max(
        MOBILE_INITIAL_ZOOM,
        getMinimumZoom(aspectRatio),
      );
      const { x: width, y: height } = getCameraSize(zoom, aspectRatio);
      setCamera(
        clampCamera(
          {
            zoom,
            x: MOBILE_INITIAL_FOCUS.x - width / 2,
            y: MOBILE_INITIAL_FOCUS.y - height / 2,
          },
          aspectRatio,
        ),
      );
      return;
    }

    if (enteredDesktop) {
      const zoom = getMinimumZoom(aspectRatio);
      const { x: width, y: height } = getCameraSize(zoom, aspectRatio);
      setCamera(
        clampCamera(
          {
            zoom,
            x: (MAP_WIDTH - width) / 2,
            y: (MAP_HEIGHT - height) / 2,
          },
          aspectRatio,
        ),
      );
      return;
    }

    setCamera((current) => {
      const zoom = current.zoom === MIN_ZOOM
        ? getMinimumZoom(aspectRatio)
        : Math.max(current.zoom, getMinimumZoom(aspectRatio));
      const { x: width, y: height } = getCameraSize(zoom, aspectRatio);
      return clampCamera(
        {
          ...current,
          zoom,
          x: (MAP_WIDTH - width) / 2,
          y: (MAP_HEIGHT - height) / 2,
        },
        aspectRatio,
      );
    });
  }, [aspectRatio, isMobileViewport]);
  const selectByKeyboard = (
    event: KeyboardEvent<SVGGElement>,
    town: TownId,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectTown(town);
    }
  };
  const mapPointer = (event: ReactPointerEvent<SVGSVGElement>): MapPointer => ({
    x: event.clientX,
    y: event.clientY,
  });
  const beginGesture = (
    event: ReactPointerEvent<SVGSVGElement>,
    nextPointers: Map<number, MapPointer>,
  ) => {
    if (isMobileViewport) {
      if (nextPointers.size > 1) return;
      gesture.current = {
        kind: "drag",
        pointerId: nextPointers.keys().next().value ?? event.pointerId,
        start: nextPointers.values().next().value ?? mapPointer(event),
        camera,
      };
      return;
    }
    if (nextPointers.size >= 2) {
      for (const pointerId of nextPointers.keys()) {
        event.currentTarget.setPointerCapture?.(pointerId);
      }
      const entries = [...nextPointers.values()];
      const rect = event.currentTarget.getBoundingClientRect();
      const midpoint = {
        x: (entries[0].x + entries[1].x) / 2,
        y: (entries[0].y + entries[1].y) / 2,
      };
      const fraction = {
        x: Math.max(0, Math.min(1, (midpoint.x - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (midpoint.y - rect.top) / rect.height)),
      };
      const { x: width, y: height } = getCameraSize(camera.zoom, aspectRatio);
      gesture.current = {
        kind: "pinch",
        distance: pointerDistance(entries[0], entries[1]),
        anchor: {
          x: camera.x + fraction.x * width,
          y: camera.y + fraction.y * height,
        },
        camera,
      };
      return;
    }

    gesture.current = {
      kind: "drag",
      pointerId: nextPointers.keys().next().value ?? event.pointerId,
      start: nextPointers.values().next().value ?? mapPointer(event),
      camera,
    };
  };
  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const nextPointers = new Map(pointers.current);
    nextPointers.set(event.pointerId, mapPointer(event));
    pointers.current = nextPointers;
    movedDuringGesture.current = false;
    beginGesture(event, nextPointers);
  };
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const nextPointers = new Map(pointers.current);
    nextPointers.set(event.pointerId, mapPointer(event));
    pointers.current = nextPointers;
    const activeGesture = gesture.current;
    if (!activeGesture) return;

    if (activeGesture.kind === "pinch" && nextPointers.size >= 2) {
      const entries = [...nextPointers.values()];
      const distance = pointerDistance(entries[0], entries[1]);
      if (Math.abs(distance - activeGesture.distance) > 2) {
        movedDuringGesture.current = true;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const midpoint = {
        x: (entries[0].x + entries[1].x) / 2,
        y: (entries[0].y + entries[1].y) / 2,
      };
      const nextZoom = Math.max(
        getMinimumZoom(aspectRatio),
        Math.min(
          MAX_ZOOM,
          activeGesture.camera.zoom *
            (distance / Math.max(1, activeGesture.distance)),
        ),
      );
      const { x: width, y: height } = getCameraSize(nextZoom, aspectRatio);
      const fraction = {
        x: Math.max(0, Math.min(1, (midpoint.x - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (midpoint.y - rect.top) / rect.height)),
      };
      setCamera(
        clampCamera(
          {
            zoom: nextZoom,
            x: activeGesture.anchor.x - fraction.x * width,
            y: activeGesture.anchor.y - fraction.y * height,
          },
          aspectRatio,
        ),
      );
      return;
    }

    if (activeGesture.kind === "drag" && activeGesture.pointerId === event.pointerId) {
      const deltaX = event.clientX - activeGesture.start.x;
      const deltaY = isMobileViewport
        ? 0
        : event.clientY - activeGesture.start.y;
      if (Math.hypot(deltaX, deltaY) > 5 && !movedDuringGesture.current) {
        movedDuringGesture.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const { x: width, y: height } = getCameraSize(
        activeGesture.camera.zoom,
        aspectRatio,
      );
      setCamera(
        clampCamera(
          {
            ...activeGesture.camera,
            x: activeGesture.camera.x - (deltaX / rect.width) * width,
            y: isMobileViewport
              ? activeGesture.camera.y
              : activeGesture.camera.y - (deltaY / rect.height) * height,
          },
          aspectRatio,
        ),
      );
    }
  };
  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const nextPointers = new Map(pointers.current);
    nextPointers.delete(event.pointerId);
    pointers.current = nextPointers;
    if (movedDuringGesture.current) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    if (nextPointers.size === 1) {
      beginGesture(event, nextPointers);
    } else {
      gesture.current = null;
      movedDuringGesture.current = false;
    }
  };
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isMobileViewport) return;
    const handleWheel = (event: WheelEvent) => {
      if (isMobileViewport) return;
      event.preventDefault();
      const rect = map.getBoundingClientRect();
      const fraction = {
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      };
      setCamera((current) => {
        const focus = {
          x: current.x + fraction.x * getCameraSize(current.zoom, aspectRatio).x,
          y: current.y + fraction.y * getCameraSize(current.zoom, aspectRatio).y,
        };
        return cameraAtZoom(
          current.zoom * (event.deltaY < 0 ? 1.16 : 1 / 1.16),
          focus,
          fraction,
          aspectRatio,
        );
      });
    };
    map.addEventListener("wheel", handleWheel, { passive: false });
    return () => map.removeEventListener("wheel", handleWheel);
  }, [aspectRatio, isMobileViewport]);
  const zoomBy = (multiplier: number) => {
    const { x: width, y: height } = getCameraSize(camera.zoom, aspectRatio);
    const focus = { x: camera.x + width / 2, y: camera.y + height / 2 };
    setCamera(
      cameraAtZoom(
        camera.zoom * multiplier,
        focus,
        { x: 0.5, y: 0.5 },
        aspectRatio,
      ),
    );
  };
  const centerOnShip = () => {
    const location = ship ?? getTown(state.currentTown);
    const zoom = Math.max(camera.zoom, 1.35);
    const { x: width, y: height } = getCameraSize(zoom, aspectRatio);
    setCamera(
      clampCamera({
        x: location.x * NAVIGATION_TO_MAP_SCALE_X - width / 2,
        y: location.y - height / 2,
        zoom,
      }, aspectRatio),
    );
  };
  const { x: viewWidth, y: viewHeight } = getCameraSize(
    camera.zoom,
    aspectRatio,
  );

  return (
    <section className="map-frame" aria-label="Illustrated map of Bengal and its river towns">
      <svg
        ref={mapRef}
        className="bengal-map"
        viewBox={`${camera.x} ${camera.y} ${viewWidth} ${viewHeight}`}
        role="img"
        aria-labelledby={`map-title-${uniqueId} map-description-${uniqueId}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <title id={`map-title-${uniqueId}`}>Bengal river-trading map</title>
        <desc id={`map-description-${uniqueId}`}>
          The supplied illustrated Bengal map shows all fifteen river and coastal markets.
          Named merchant boats move along the marked routes as in-game sailing days pass.
          {isMobileViewport
            ? " Swipe horizontally to explore, or select a marked port."
            : " Drag to pan, zoom to look closer, or select a marked port."}
        </desc>
        <defs>
          <filter id={`town-shadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#27443a" floodOpacity=".23" />
          </filter>
        </defs>
        <image
          href="/images/bengal-world-map.png"
          x="0"
          y="0"
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          preserveAspectRatio="xMidYMid meet"
        />

        <g transform={`scale(${NAVIGATION_TO_MAP_SCALE_X} 1)`}>
          {routeIsDisplayed && (
            <g aria-hidden="true">
              <path
                d={riverPointsToSvgPath(route?.points ?? [])}
                fill="none"
                stroke="#fff9e6"
                strokeWidth="10"
                strokeLinecap="round"
                opacity=".8"
              />
              <path
                d={riverPointsToSvgPath(route?.points ?? [])}
                fill="none"
                stroke={state.voyage ? "#b9683b" : "#316556"}
                strokeWidth="3.5"
                strokeDasharray={state.voyage ? "9 7" : "3 8"}
                strokeLinecap="round"
                className={state.voyage ? "route-moving" : ""}
                opacity=".92"
              />
            </g>
          )}

          {state.npcMerchants
            .filter((merchant) => merchant.phase === "traveling")
            .map((merchant, index) => {
              const merchantRoute = getTownRoute(
                merchant.currentPort,
                merchant.destinationPort,
              );
              if (!merchantRoute) return null;
              const travelProgress = Math.max(
                0,
                Math.min(
                  1,
                  1 - merchant.travelDaysRemaining / merchant.travelDaysTotal,
                ),
              );
              const position = pointAlongRiverRoute(merchantRoute, travelProgress);
              const color = index % 2 === 0 ? "#7a593f" : "#596b47";
              return (
                <g key={merchant.id} aria-label={`${merchant.name} traveling`}>
                  <path
                    d={riverPointsToSvgPath(merchantRoute.points)}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeDasharray="4 8"
                    strokeLinecap="round"
                    opacity=".56"
                    aria-hidden="true"
                  />
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r="7"
                    fill="#fff5dc"
                    stroke={color}
                    strokeWidth="3"
                  >
                    <title>
                      {merchant.name}: {getTown(merchant.currentPort).name} to{" "}
                      {getTown(merchant.destinationPort).name}
                    </title>
                  </circle>
                </g>
              );
            })}

          {TOWNS.map((town) => {
            const current = town.id === state.currentTown;
            const selected = town.id === state.selectedTown;
            const disabled =
              !interactive || Boolean(state.voyage || state.encounterPending);

            return (
              <g
                key={town.id}
                role={interactive ? "button" : undefined}
                tabIndex={!interactive || disabled ? -1 : 0}
                aria-label={`${town.name}${current ? ", your boat is here" : ""}${selected ? ", selected destination" : ""}`}
                aria-pressed={interactive ? selected : undefined}
                aria-disabled={interactive ? disabled : undefined}
                className={`town-marker${selected ? " town-selected" : ""}${current ? " town-current" : ""}${disabled ? " town-locked" : ""}`}
                onClick={
                  interactive
                    ? () => {
                        if (suppressClick.current) {
                          suppressClick.current = false;
                          return;
                        }
                        if (!disabled) onSelectTown(town.id);
                      }
                    : undefined
                }
                onKeyDown={
                  interactive
                    ? (event) => selectByKeyboard(event, town.id)
                    : undefined
                }
              >
                <circle
                  cx={town.x}
                  cy={town.y}
                  r="68"
                  fill="transparent"
                  pointerEvents="all"
                />
                <circle
                  cx={town.x}
                  cy={town.y}
                  r="24"
                  fill="none"
                  stroke={current ? "#b75b37" : selected ? "#416c53" : "#f7edd1"}
                  strokeWidth="4"
                  opacity={current || selected ? ".96" : ".76"}
                  filter={selected ? `url(#town-shadow-${uniqueId})` : undefined}
                />
                <circle
                  cx={town.x}
                  cy={town.y}
                  r="8"
                  fill={current ? "#c2643b" : selected ? "#416c53" : "#f6eed5"}
                  stroke="#405547"
                  strokeWidth="2"
                />
                <circle
                  cx={town.x}
                  cy={town.y}
                  r="3"
                  fill={current || selected ? "#fff0ce" : "#60764f"}
                />
                {current && !state.voyage && (
                  <circle
                    cx={town.x}
                    cy={town.y}
                    r="32"
                    fill="none"
                    stroke="#b75b37"
                    strokeWidth="3"
                    strokeDasharray="3 4"
                    className="current-port-ring"
                  />
                )}
                <title>{town.name}</title>
                {current && (
                  <text
                    x={town.x}
                    y={town.y + 42}
                    textAnchor="middle"
                    fill="#805643"
                    fontSize="9"
                    letterSpacing="1.2"
                    fontWeight="750"
                    fontFamily="Arial, sans-serif"
                  >
                    YOUR SHIP
                  </text>
                )}
              </g>
            );
          })}

          {state.voyage && ship && (
            <>
              <circle cx={ship.x} cy={ship.y} r="14" fill="#f5cb91" opacity=".13" className="ship-wake" />
              <BengalTradingVessel x={ship.x} y={ship.y} moving />
            </>
          )}
          {!state.voyage && (
            <BengalTradingVessel
              x={getTown(state.currentTown).x}
              y={getTown(state.currentTown).y - 2}
            />
          )}
        </g>
      </svg>
      <div className="map-stamp" aria-hidden="true">
        <span className="map-stamp-dot" />
        BENGAL · c. 1665
      </div>
      <div className="map-caption">
        <div>
          <span className="eyebrow map-eyebrow">YOUR NEXT STOP</span>
          <strong>          {state.voyage
            ? "Under sail"
            : state.currentTown === state.selectedTown
              ? "Choose your next port"
              : route
                ? displayedRouteTime
                  ? `${TOWNS.find((town) => town.id === state.selectedTown)?.name}, ${formatTravelDuration(displayedRouteTime.durationMs)} away`
                  : "No open river path"
                : getShipRoutePreview(state, state.selectedTown).tooLarge
                  ? "Too large for this ship"
                  : "No open river path"}</strong>
        </div>
        <span className="map-caption-pin" aria-hidden="true">
          {state.voyage
            ? "Following the waterway"
            : state.currentTown === state.selectedTown
              ? "Tap a town"
              : route
                ? "Tap a town"
                : "Route closed"}
        </span>
        {!isMobileViewport && (
            <div className="map-camera-controls" role="group" aria-label="Map controls">
              <button
                className="map-camera-button"
                type="button"
                aria-label="Zoom out"
                disabled={camera.zoom <= getMinimumZoom(aspectRatio)}
                onClick={() => zoomBy(1 / 1.3)}
              >
                −
              </button>
              <button
                className="map-camera-button"
                type="button"
                aria-label="Zoom in"
                disabled={camera.zoom >= MAX_ZOOM}
                onClick={() => zoomBy(1.3)}
              >
                +
              </button>
              <button
                className="map-camera-button map-center-button"
                type="button"
                aria-label="Center on your ship"
                onClick={centerOnShip}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="6" />
                  <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                </svg>
              </button>
            </div>
        )}
      </div>
    </section>
  );
}
