import {
  memo,
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
  getShipRouteConditions,
  getShipRoutePreview,
  getTownRoute,
  isHistoricalRouteAlertActive,
  type GameState,
  type PlayerShip,
  type TownId,
} from "../game/model";
import {
  pointAlongRiverRoute,
  riverPointsToSvgPath,
  type RiverPoint,
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

const LABEL_CHARACTER_WIDTH = 8.1;
const LABEL_PADDING = 24;

// Keeps each name clear of its own port and its neighbours' markers.
const LABEL_PLACEMENT: Partial<Record<TownId, { dx: number; dy: number }>> = {
  hooghly: { dx: -6, dy: -33 },
  satgaon: { dx: 10, dy: 33 },
  rajmahal: { dx: 0, dy: -30 },
  tanda: { dx: -47, dy: 0 },
  kasimbazar: { dx: 0, dy: 32 },
  jessore: { dx: 6, dy: 32 },
  malda: { dx: 24, dy: 31 },
  sonargaon: { dx: 22, dy: -30 },
  dhaka: { dx: -8, dy: 32 },
  "bakla-chandradwip": { dx: 8, dy: 32 },
  sandwip: { dx: 0, dy: 33 },
  balasore: { dx: 14, dy: 32 },
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

// The painting always fills the frame; squarer screens pan across it instead of
// showing empty bands above and below.
function getMinimumZoom(_aspectRatio: number): number {
  return MIN_ZOOM;
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

function toMapPoint(point: RiverPoint): RiverPoint {
  return { x: point.x * NAVIGATION_TO_MAP_SCALE_X, y: point.y };
}

function toMapPath(points: RiverPoint[]): string {
  return riverPointsToSvgPath(points.map(toMapPoint));
}

function getRouteFacing(route: RiverRoute, progress: number): 1 | -1 {
  const ahead = pointAlongRiverRoute(route, Math.min(1, progress + 0.02));
  const behind = pointAlongRiverRoute(route, Math.max(0, progress - 0.02));
  return ahead.x >= behind.x ? 1 : -1;
}

function getFleetShipRoute(
  state: GameState,
  ship: PlayerShip,
): { route: RiverRoute; progress: number } | null {
  const trip = ship.returnOrder
    ? {
        destination: ship.returnOrder.destination,
        remaining: ship.returnOrder.travelDaysRemaining,
        total: ship.returnOrder.travelDaysTotal,
      }
    : ship.automatedRoute?.phase === "traveling"
      ? {
          destination: ship.automatedRoute.destinationPort,
          remaining: ship.automatedRoute.travelDaysRemaining,
          total: ship.automatedRoute.travelDaysTotal,
        }
      : null;
  if (!trip || trip.destination === ship.currentPort) return null;
  const route = getTownRoute(
    ship.currentPort,
    trip.destination,
    getShipRouteConditions(state.navigationConditions, ship.vesselClass),
  );
  return route
    ? { route, progress: Math.max(0, Math.min(1, 1 - trip.remaining / trip.total)) }
    : null;
}

// Painted layers are separate elements so the browser can animate them without
// repainting the markers and routes that sit above them.
const MapPlates = memo(function MapPlates({ viewBox }: { viewBox: string }) {
  const plate = (href: string, className: string) => (
    <svg className={`map-plate ${className}`} viewBox={viewBox} aria-hidden="true">
      <image
        href={href}
        x="0"
        y="0"
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
  return (
    <>
      {plate("/images/bengal-world-map.webp", "map-plate-base")}
      {plate("/images/water-shimmer-a.webp", "map-plate-shimmer-a")}
      {plate("/images/water-shimmer-b.webp", "map-plate-shimmer-b")}
    </>
  );
});

const MapAtmosphere = memo(function MapAtmosphere() {
  return (
    <div className="map-atmosphere" aria-hidden="true">
      <span className="cloud-shadow cloud-shadow-a" />
      <span className="cloud-shadow cloud-shadow-b" />
      <span className="cloud-wisp" />
      <svg className="map-birds" viewBox="0 0 90 30">
        <path d="M6 16q5-7 9 0 5-7 9 0M36 8q4-6 8 0 4-6 8 0M58 22q4-6 8 0 4-6 8 0" fill="none" stroke="#2a1b12" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
});

const MapCompass = memo(function MapCompass() {
  return (
    <svg className="map-compass" viewBox="-50 -50 100 100" aria-hidden="true">
      <circle r="44" fill="#f0e3c3" fillOpacity=".9" stroke="#3a2513" strokeWidth="2" />
      <circle r="38" fill="none" stroke="#8a6a2a" strokeWidth="1" />
      <path d="M0-36 7-7 36 0 7 7 0 36-7 7-36 0-7-7Z" fill="#3a2513" />
      <path d="M0-36V0L7-7ZM36 0H0L7 7ZM0 36V0L-7 7ZM-36 0H0L-7-7Z" fill="#b28a3c" />
      <path d="M-20-20-4-4M20-20 4-4M20 20 4 4M-20 20-4 4" stroke="#3a2513" strokeWidth="2.4" strokeLinecap="round" />
      <text y="-27" textAnchor="middle" className="map-compass-north">N</text>
    </svg>
  );
});

export default function BengalMap({
  state,
  now,
  onSelectTown,
  interactive = true,
}: BengalMapProps) {
  const uniqueId = useId().replace(/:/g, "");
  const [camera, setCamera] = useState<MapCamera>({ x: 0, y: 0, zoom: 1 });
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [mapPixelHeight, setMapPixelHeight] = useState(0);
  const [followShip, setFollowShip] = useState(true);
  const cameraPlaced = useRef(false);
  const lastAspectRatio = useRef(aspectRatio);
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
  const shipPoint = voyage && route ? pointAlongRiverRoute(route, progress) : null;
  const ship = shipPoint ? toMapPoint(shipPoint) : null;
  const selectedVessel = getSelectedVesselClass(state);
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
      if (width > 0 && height > 0) {
        setAspectRatio(width / height);
        setMapPixelHeight(height);
      }
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
      const firstPlacement = !cameraPlaced.current || mapPixelHeight === 0;
      cameraPlaced.current = mapPixelHeight > 0;
      const placedAspect = lastAspectRatio.current;
      lastAspectRatio.current = aspectRatio;
      // Panels resize the map on phones; keep looking at the same place when they do.
      setCamera((current) => {
        const previous = getCameraSize(current.zoom, placedAspect);
        const home = toMapPoint(getTown(state.currentTown));
        const focus = firstPlacement
          ? { x: interactive ? home.x : MOBILE_INITIAL_FOCUS.x, y: MOBILE_INITIAL_FOCUS.y }
          : { x: current.x + previous.x / 2, y: MOBILE_INITIAL_FOCUS.y };
        return clampCamera(
          {
            zoom,
            x: focus.x - width / 2,
            y: focus.y - height / 2,
          },
          aspectRatio,
        );
      });
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
    // Only the viewport changes this placement; later port changes must not move the camera.
  }, [aspectRatio, isMobileViewport]);
  // A new voyage starts following the ship; dragging the map hands control back.
  const voyageStart = voyage?.startedAt;
  useEffect(() => {
    if (voyageStart !== undefined) setFollowShip(true);
  }, [voyageStart]);
  const shipX = ship?.x;
  const shipY = ship?.y;
  useEffect(() => {
    if (shipX === undefined || shipY === undefined || !followShip) return;
    setCamera((current) => {
      const { x: width, y: height } = getCameraSize(current.zoom, aspectRatio);
      return clampCamera(
        { ...current, x: shipX - width / 2, y: shipY - height / 2 },
        aspectRatio,
      );
    });
  }, [shipX, shipY, followShip, aspectRatio]);
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
        setFollowShip(false);
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
    const location = ship ?? toMapPoint(getTown(state.currentTown));
    const zoom = Math.max(camera.zoom, 1.35);
    const { x: width, y: height } = getCameraSize(zoom, aspectRatio);
    setFollowShip(true);
    setCamera(
      clampCamera({
        x: location.x - width / 2,
        y: location.y - height / 2,
        zoom,
      }, aspectRatio),
    );
  };
  const { x: viewWidth, y: viewHeight } = getCameraSize(
    camera.zoom,
    aspectRatio,
  );

  const viewBox = `${camera.x} ${camera.y} ${viewWidth} ${viewHeight}`;
  // Markers keep one on-screen size at every zoom so names stay readable.
  const pixelsPerUnit = mapPixelHeight > 0 ? mapPixelHeight / viewHeight : 1;
  const markerScale = Math.max(0.5, Math.min(2.4, 0.88 / pixelsPerUnit));
  const homePoint = toMapPoint(getTown(state.currentTown));
  const shipFacing =
    voyage && route ? getRouteFacing(route, progress) : 1;
  const fleetShips = state.fleet.filter(
    (entry) => entry.id !== state.selectedShipId,
  );

  return (
    <section className="map-frame" aria-label="Illustrated map of Bengal and its river towns">
      <div className="map-viewport">
        <MapPlates viewBox={viewBox} />
        <MapAtmosphere />
        <svg
          ref={mapRef}
          className="bengal-map"
          viewBox={viewBox}
          role="group"
          aria-labelledby={`map-title-${uniqueId} map-description-${uniqueId}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <title id={`map-title-${uniqueId}`}>Bengal river-trading map</title>
          <desc id={`map-description-${uniqueId}`}>
            An illustrated Bengal map showing all fifteen river and coastal markets.
            Named merchant boats move along the marked routes as in-game sailing days pass.
            {isMobileViewport
              ? " Swipe horizontally to explore, or select a marked port."
              : " Drag to pan, zoom to look closer, or select a marked port."}
          </desc>

          {routeIsDisplayed && route && (
            <g aria-hidden="true" className={state.voyage ? "route-voyage" : "route-preview"}>
              <path
                d={toMapPath(route.points)}
                fill="none"
                stroke="#1c120a"
                strokeWidth={9 * markerScale}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity=".42"
              />
              <path
                d={toMapPath(route.points)}
                fill="none"
                stroke="#fff6dc"
                strokeWidth={5.4 * markerScale}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity=".95"
              />
              <path
                d={toMapPath(route.points)}
                fill="none"
                stroke={state.voyage ? "#a03a1c" : "#1f4d40"}
                strokeWidth={3 * markerScale}
                strokeDasharray={`${10 * markerScale} ${7 * markerScale}`}
                strokeLinecap="butt"
                strokeLinejoin="round"
                className={state.voyage ? "route-moving" : ""}
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
              const position = toMapPoint(
                pointAlongRiverRoute(merchantRoute, travelProgress),
              );
              const color = index % 2 === 0 ? "#f0dfb6" : "#d8e3c4";
              return (
                <g key={merchant.id} role="img" aria-label={`${merchant.name} traveling`} className="npc-traffic">
                  <path
                    d={toMapPath(merchantRoute.points)}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.8 * markerScale}
                    strokeDasharray={`${3 * markerScale} ${8 * markerScale}`}
                    strokeLinecap="round"
                    opacity=".6"
                    aria-hidden="true"
                  />
                  <BengalTradingVessel
                    x={position.x}
                    y={position.y}
                    moving
                    facing={getRouteFacing(merchantRoute, travelProgress)}
                    size={0.62 * markerScale}
                  />
                  <circle cx={position.x} cy={position.y} r={14 * markerScale} fill="transparent">
                    <title>
                      {merchant.name}: {getTown(merchant.currentPort).name} to{" "}
                      {getTown(merchant.destinationPort).name}
                    </title>
                  </circle>
                </g>
              );
            })}

          {fleetShips.map((entry, index) => {
            const trip = getFleetShipRoute(state, entry);
            const position = trip
              ? toMapPoint(pointAlongRiverRoute(trip.route, trip.progress))
              : toMapPoint(getTown(entry.currentPort));
            return (
              <g key={entry.id} role="img" className="fleet-traffic" aria-label={`Your ship ${entry.name}`}>
                <BengalTradingVessel
                  x={position.x + (trip ? 0 : (-26 - index * 14) * markerScale)}
                  y={position.y + (trip ? 0 : 10 * markerScale)}
                  moving={Boolean(trip)}
                  vesselClass={entry.vesselClass}
                  facing={trip ? getRouteFacing(trip.route, trip.progress) : 1}
                  size={0.72 * markerScale}
                />
              </g>
            );
          })}

          {state.voyage && ship && (
            <>
              <circle
                cx={ship.x}
                cy={ship.y + 3 * markerScale}
                r={21 * markerScale}
                className="ship-wake"
              />
              <BengalTradingVessel
                x={ship.x}
                y={ship.y}
                moving
                vesselClass={selectedVessel.id}
                facing={shipFacing}
                size={markerScale}
              />
            </>
          )}
          {!state.voyage && (
            <BengalTradingVessel
              x={homePoint.x + 25 * markerScale}
              y={homePoint.y + 7 * markerScale}
              vesselClass={selectedVessel.id}
              size={markerScale}
            />
          )}

          {TOWNS.map((town) => {
            const current = town.id === state.currentTown;
            const selected = town.id === state.selectedTown;
            const disabled =
              !interactive || Boolean(state.voyage || state.encounterPending);
            const point = toMapPoint(town);
            const placement = LABEL_PLACEMENT[town.id] ?? { dx: 0, dy: -31 };
            const labelWidth =
              town.name.length * LABEL_CHARACTER_WIDTH + LABEL_PADDING;
            // A phone's map shrinks under the voyage log, so only name the trip's ends.
            const showLabel =
              !(voyage && isMobileViewport) || current || selected;

            return (
              <g
                key={town.id}
                role={interactive ? "button" : undefined}
                tabIndex={!interactive || disabled ? -1 : 0}
                aria-label={`${town.name}${current ? ", your boat is here" : ""}${selected ? ", selected destination" : ""}`}
                aria-pressed={interactive ? selected : undefined}
                aria-disabled={interactive ? disabled : undefined}
                className={`town-marker${selected ? " town-selected" : ""}${current ? " town-current" : ""}${disabled ? " town-locked" : ""}`}
                transform={`translate(${point.x} ${point.y}) scale(${markerScale})`}
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
                <title>{town.name}</title>
                <circle r="26" fill="transparent" pointerEvents="all" />
                <rect
                  x={placement.dx - labelWidth / 2 - 4}
                  y={placement.dy - 15}
                  width={labelWidth + 8}
                  height="30"
                  fill="transparent"
                  pointerEvents="all"
                />
                {selected && !current && <circle r="17" className="town-selected-ring" />}
                {current && !state.voyage && <circle r="20" className="current-port-ring" />}
                <circle r={current || selected ? 10 : 7.5} className="town-pin-disc" />
                <circle r={current || selected ? 6.5 : 4} className="town-pin-core" />
                {current && (
                  <path d="M0-4.5v9m-3.6-6.3h7.2M-4.4 1.2q.6 3.4 4.4 3.4t4.4-3.4" className="town-pin-glyph" />
                )}
                {selected && !current && (
                  <path d="M-2.4 4.5v-9l5.4 2.6-5.4 2.6" className="town-pin-glyph" />
                )}
                {showLabel && (
                  <g transform={`translate(${placement.dx} ${placement.dy})`} className="town-label">
                    <path
                      d={`M${-labelWidth / 2} -10.5q-4.5 0-6.5 4l3 6.5-3 6.5q2 4 6.5 4H${labelWidth / 2}q4.5 0 6.5-4l-3-6.5 3-6.5q-2-4-6.5-4Z`}
                      className="town-label-plate"
                    />
                    <text y="5.2" textAnchor="middle" className="town-label-text">{town.name}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        <div className="map-vignette" aria-hidden="true" />
      </div>
      <div className="map-stamp" aria-hidden="true">
        <span className="map-stamp-kicker">The Rivers of</span>
        <span className="map-stamp-title">Bengal</span>
        <span className="map-stamp-year">c. 1665</span>
      </div>
      <MapCompass />
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
      <div className="map-caption">
        <span className="eyebrow map-eyebrow">YOUR NEXT STOP</span>
        <strong>{state.voyage
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
    </section>
  );
}
