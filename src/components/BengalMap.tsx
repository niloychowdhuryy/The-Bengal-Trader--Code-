import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  TOWNS,
  getTown,
  getSelectedVesselClass,
  getShipRouteConditions,
  getShipRoutePreview,
  getMerchantRoute,
  getTownRoute,
  isHistoricalRouteAlertActive,
  VESSEL_CLASSES,
  type GameState,
  type PlayerShip,
  type TownId,
  type VesselClassId,
} from "../game/model";
import {
  PORT_QUAYS,
  getRouteStateAt,
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
import LandCart from "./map-art/LandCart";

const NAVIGATION_MAP_WIDTH = 1152;
const MAP_HEIGHT = 768;
const MAP_WIDTH = 1365;
const NAVIGATION_TO_MAP_SCALE_X = MAP_WIDTH / NAVIGATION_MAP_WIDTH;
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.7;
const DEFAULT_ASPECT_RATIO = MAP_WIDTH / MAP_HEIGHT;
const MOBILE_BREAKPOINT = "(max-width: 759px)";
const MOBILE_INITIAL_ZOOM = 1.5;
/** Phones keep one on-screen map scale, however tall the map area is. */
const MOBILE_PIXELS_PER_UNIT = 0.94;
/** Just below the labels of the southernmost ports. */
const SOUTHERN_PORTS_LINE = 610;
/** Room kept around a selected port for its marker and name, in screen pixels. */
const PORT_CLEARANCE_PIXELS = 58;
/** A panel growing by more than this is being opened, not just re-measured. */
const PANEL_OPENED_PIXELS = 40;

function getMobileZoom(pixelHeight: number, aspectRatio: number): number {
  if (pixelHeight <= 0) return MOBILE_INITIAL_ZOOM;
  const baseHeight = Math.min(MAP_HEIGHT, MAP_WIDTH / aspectRatio);
  return Math.max(
    MIN_ZOOM,
    Math.min(MAX_ZOOM, baseHeight / (pixelHeight / MOBILE_PIXELS_PER_UNIT)),
  );
}
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

/**
 * Keeps the view on the painting. `bottomSpace`, in map units, is how far the view may
 * move past the south edge, so the south can always be brought above a panel.
 */
export function clampCamera(
  camera: MapCamera,
  aspectRatio: number,
  bottomSpace = 0,
): MapCamera {
  const { x: width, y: height } = getCameraSize(camera.zoom, aspectRatio);
  const clampAxis = (position: number, size: number, mapSize: number, extra: number) => {
    const least = size >= mapSize ? (mapSize - size) / 2 : 0;
    const most = (size >= mapSize ? (mapSize - size) / 2 : mapSize - size) + extra;
    return Math.max(least, Math.min(most, position));
  };
  return {
    ...camera,
    x: clampAxis(camera.x, width, MAP_WIDTH, 0),
    y: clampAxis(camera.y, height, MAP_HEIGHT, bottomSpace),
  };
}

function cameraAtZoom(
  zoom: number,
  focus: MapPointer,
  focusFraction: MapPointer,
  aspectRatio: number,
  clamp: (camera: MapCamera, aspectRatio: number) => MapCamera = clampCamera,
): MapCamera {
  const nextZoom = Math.max(
    getMinimumZoom(aspectRatio),
    Math.min(MAX_ZOOM, zoom),
  );
  const { x: width, y: height } = getCameraSize(nextZoom, aspectRatio);
  return clamp({
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

// The rest are counted beside them, so a busy port stays readable on a phone.
const DOCKED_SHIPS_SHOWN = 3;
const DOCKED_SHIP_SPACING = 15;
// A comfortable fingertip, in screen pixels, however far the map is zoomed.
const TOUCH_TARGET_PIXELS = 44;

function hasCoarsePointer(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

interface BengalMapProps {
  state: GameState;
  now: number;
  onSelectTown: (town: TownId) => void;
  onSelectMerchant?: (merchantId: string) => void;
  /** A finger can't pick between ships this close, so a dock's ships are chosen from a list. */
  onSelectDock?: (town: TownId) => void;
  selectedMerchantId?: string | null;
  interactive?: boolean;
  /** Hidden rather than removed, so it keeps its camera and loaded art. */
  hidden?: boolean;
  /** Screen pixels of the map covered by a panel along its bottom edge. */
  bottomInset?: number;
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

function getRouteFacing(route: RiverRoute, progress: number, travelFactor = 1): 1 | -1 {
  const ahead = getRouteStateAt(route, Math.min(1, progress + 0.02), travelFactor).point;
  const behind = getRouteStateAt(route, Math.max(0, progress - 0.02), travelFactor).point;
  return ahead.x >= behind.x ? 1 : -1;
}

/** A boat on water and a cart on land, always from the same journey state. */
function JourneyVehicle({
  route,
  progress,
  travelFactor = 1,
  vesselClass,
  size,
}: {
  route: RiverRoute;
  progress: number;
  travelFactor?: number;
  vesselClass?: VesselClassId;
  size: number;
}) {
  const state = getRouteStateAt(route, progress, travelFactor);
  const point = toMapPoint(state.point);
  const facing = getRouteFacing(route, progress, travelFactor);
  if (state.transferring) {
    // Cargo moving between them at the landing: the boat moors while the cart waits.
    return (
      <g className="journey-transfer">
        <BengalTradingVessel x={point.x} y={point.y} vesselClass={vesselClass} facing={facing} size={size} />
        <LandCart x={point.x - 20 * size} y={point.y - 13 * size} facing={facing} size={size * 0.85} />
      </g>
    );
  }
  return state.mode === "land" ? (
    <LandCart x={point.x} y={point.y} moving facing={facing} size={size} />
  ) : (
    <BengalTradingVessel x={point.x} y={point.y} moving vesselClass={vesselClass} facing={facing} size={size} />
  );
}

function RouteLine({
  route,
  sailing,
  scale,
}: {
  route: RiverRoute;
  sailing: boolean;
  scale: number;
}) {
  return (
    <g aria-hidden="true" className={sailing ? "route-voyage" : "route-preview"}>
      {route.legs.map((leg) => {
        const path = toMapPath(route.points.slice(leg.firstPoint, leg.lastPoint + 1));
        const land = leg.mode === "land";
        return (
          <g key={leg.firstPoint} className={land ? "route-leg-land" : "route-leg-water"}>
            <path d={path} fill="none" stroke="#1c120a" strokeWidth={9 * scale} strokeLinecap="round" strokeLinejoin="round" opacity=".42" />
            <path d={path} fill="none" stroke={land ? "#f0d9a8" : "#fff6dc"} strokeWidth={5.4 * scale} strokeLinecap="round" strokeLinejoin="round" opacity=".95" />
            <path
              d={path}
              fill="none"
              stroke={land ? "#6b3f1c" : sailing ? "#a03a1c" : "#1f4d40"}
              strokeWidth={3 * scale}
              strokeDasharray={land ? `${2 * scale} ${6 * scale}` : `${10 * scale} ${7 * scale}`}
              strokeLinecap={land ? "round" : "butt"}
              strokeLinejoin="round"
              className={sailing && !land ? "route-moving" : ""}
            />
          </g>
        );
      })}
      {route.legs.slice(1).map((leg) => {
        const point = toMapPoint(route.points[leg.firstPoint]);
        return (
          <circle
            key={leg.firstPoint}
            className="route-transfer-point"
            cx={point.x}
            cy={point.y}
            r={5 * scale}
          />
        );
      })}
    </g>
  );
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

const MAP_ART = [
  { href: "/images/bengal-world-map.webp", className: "map-plate-base" },
  { href: "/images/water-shimmer-a.webp", className: "map-plate-shimmer-a" },
  { href: "/images/water-shimmer-b.webp", className: "map-plate-shimmer-b" },
];
const ART_RETRY_MS = 4_000;

// Holding these keeps the art in the browser's memory, so the map doesn't depend on
// the network again after its first load.
const heldArt = new Map<string, HTMLImageElement>();
function holdArt(href: string) {
  if (heldArt.has(href) || typeof Image === "undefined") return;
  const image = new Image();
  image.src = href;
  heldArt.set(href, image);
}

/**
 * One painted layer. If the art can't load it shows nothing rather than the browser's
 * stretched broken-image icon, and tries again, including when the connection returns.
 */
function MapPlate({
  href,
  className,
  viewBox,
  onFailureChange,
}: {
  href: string;
  className: string;
  viewBox: string;
  onFailureChange?: (failed: boolean) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    holdArt(href);
  }, [href]);
  useEffect(() => {
    onFailureChange?.(failed);
    if (!failed) return;
    const retry = () => {
      setFailed(false);
      setAttempt((current) => current + 1);
    };
    const timer = window.setTimeout(retry, ART_RETRY_MS);
    window.addEventListener("online", retry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retry);
    };
  }, [failed, onFailureChange]);
  return (
    <svg className={`map-plate ${className}`} viewBox={viewBox} aria-hidden="true">
      {!failed && (
        <image
          key={attempt}
          href={href}
          x="0"
          y="0"
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          preserveAspectRatio="xMidYMid meet"
          onError={() => setFailed(true)}
        />
      )}
    </svg>
  );
}

// Painted layers are separate elements so the browser can animate them without
// repainting the markers and routes that sit above them.
const MapPlates = memo(function MapPlates({
  viewBox,
  onBaseFailureChange,
}: {
  viewBox: string;
  onBaseFailureChange: (failed: boolean) => void;
}) {
  return (
    <>
      {MAP_ART.map((art, index) => (
        <MapPlate
          key={art.href}
          {...art}
          viewBox={viewBox}
          onFailureChange={index === 0 ? onBaseFailureChange : undefined}
        />
      ))}
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
  onSelectMerchant,
  onSelectDock,
  selectedMerchantId = null,
  interactive = true,
  hidden = false,
  bottomInset = 0,
}: BengalMapProps) {
  const [artMissing, setArtMissing] = useState(false);
  const uniqueId = useId().replace(/:/g, "");
  const [camera, setCamera] = useState<MapCamera>({ x: 0, y: 0, zoom: 1 });
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [mapPixelHeight, setMapPixelHeight] = useState(0);
  const [followShip, setFollowShip] = useState(true);
  const cameraPlaced = useRef(false);
  const insetRef = useRef(bottomInset);
  insetRef.current = bottomInset;
  const pixelHeightRef = useRef(0);
  const clampView = (next: MapCamera, aspect: number) => {
    const units = getCameraSize(next.zoom, aspect).y;
    const space =
      pixelHeightRef.current > 0 ? (insetRef.current / pixelHeightRef.current) * units : 0;
    return clampCamera(next, aspect, space);
  };
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
  const selectedVessel = getSelectedVesselClass(state);
  const shipPoint =
    voyage && route
      ? getRouteStateAt(route, progress, selectedVessel.travelFactor).point
      : null;
  const ship = shipPoint ? toMapPoint(shipPoint) : null;
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
        pixelHeightRef.current = height;
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
      const zoom = getMobileZoom(pixelHeightRef.current, aspectRatio);
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
          ? interactive
            ? home
            : MOBILE_INITIAL_FOCUS
          : { x: current.x + previous.x / 2, y: current.y + previous.y / 2 };
        return clampView(
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
        clampView(
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
      return clampView(
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
  // Moves the view clear of the panel: the selected port always, and when the panel opens
  // the southern ports too, if there's room for both. Closing it puts the view back.
  const savedCameraY = useRef<number | null>(null);
  const previousInset = useRef(bottomInset);
  const selectedTown = state.selectedTown;
  useEffect(() => {
    // Going from or to no panel at all means changing screen, not opening or closing it,
    // and returning to the map must leave the view exactly where the player had it.
    const change =
      bottomInset > 0 && previousInset.current > 0 ? bottomInset - previousInset.current : 0;
    previousInset.current = bottomInset;
    if (!interactive || hidden || voyage || mapPixelHeight <= 0) return;
    setCamera((current) => {
      const { x: width, y: height } = getCameraSize(current.zoom, aspectRatio);
      const scale = mapPixelHeight / height;
      const visible = height - bottomInset / scale;
      const clearance = PORT_CLEARANCE_PIXELS / scale;
      const port = toMapPoint(getTown(selectedTown));
      let x = current.x;
      let y = current.y;
      if (change > PANEL_OPENED_PIXELS) {
        savedCameraY.current = current.y;
        y = Math.max(y, SOUTHERN_PORTS_LINE - visible);
      } else if (change < -PANEL_OPENED_PIXELS && savedCameraY.current !== null) {
        y = savedCameraY.current;
        savedCameraY.current = null;
      }
      if (port.y + clearance > y + visible) y = port.y + clearance - visible;
      if (port.y - clearance < y) y = port.y - clearance;
      if (port.x - clearance < x) x = port.x - clearance;
      if (port.x + clearance > x + width) x = port.x + clearance - width;
      if (x === current.x && y === current.y) return current;
      return clampView({ ...current, x, y }, aspectRatio);
    });
  }, [selectedTown, bottomInset, mapPixelHeight, aspectRatio, hidden, interactive, Boolean(voyage)]);
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
      return clampView(
        { ...current, x: shipX - width / 2, y: shipY - height / 2 },
        aspectRatio,
      );
    });
  }, [shipX, shipY, followShip, aspectRatio]);
  const liveDay = state.sailingDay + (voyage ? progress * voyage.durationDays : 0);
  const touchScreen = isMobileViewport || hasCoarsePointer();
  const selectDock = (town: TownId) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onSelectDock?.(town);
  };
  const selectMerchant = (merchantId: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onSelectMerchant?.(merchantId);
  };
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
        clampView(
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
      const deltaY = event.clientY - activeGesture.start.y;
      if (Math.hypot(deltaX, deltaY) > 5 && !movedDuringGesture.current) {
        movedDuringGesture.current = true;
        setFollowShip(false);
        savedCameraY.current = null;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const { x: width, y: height } = getCameraSize(
        activeGesture.camera.zoom,
        aspectRatio,
      );
      setCamera(
        clampView(
          {
            ...activeGesture.camera,
            x: activeGesture.camera.x - (deltaX / rect.width) * width,
            y: activeGesture.camera.y - (deltaY / rect.height) * height,
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
      clampView({
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
  const touchRadius = TOUCH_TARGET_PIXELS / 2 / pixelsPerUnit;
  const markerScale = Math.max(0.5, Math.min(2.4, 0.88 / pixelsPerUnit));
  const homePoint = toMapPoint(PORT_QUAYS[state.currentTown]);
  const fleetShips = state.fleet.filter(
    (entry) => entry.id !== state.selectedShipId,
  );

  return (
    <section
      className="map-frame"
      hidden={hidden}
      aria-label="Illustrated map of Bengal and its river towns"
      style={{ "--map-bottom-inset": `${bottomInset}px` } as CSSProperties}
    >
      <div className="map-viewport">
        <MapPlates viewBox={viewBox} onBaseFailureChange={setArtMissing} />
        {artMissing && (
          <p className="map-art-missing" role="status">
            The map painting couldn't load. Trying again... You can still choose ports.
          </p>
        )}
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
              ? " Drag to explore, or select a marked port."
              : " Drag to pan, zoom to look closer, or select a marked port."}
          </desc>

          {routeIsDisplayed && route && (
            <RouteLine route={route} sailing={Boolean(state.voyage)} scale={markerScale} />
          )}

          {state.npcMerchants
            .filter((merchant) => merchant.phase === "traveling")
            .map((merchant) => {
              const merchantRoute = getMerchantRoute(
                merchant.currentPort,
                merchant.destinationPort,
                merchant.vesselClass,
                state.navigationConditions,
              );
              if (!merchantRoute) return null;
              // Days tick over one at a time, so glide between them while the player sails.
              const dayProgress = Math.max(0, Math.min(1, liveDay - state.worldDay));
              const travelProgress = Math.max(
                0,
                Math.min(
                  1,
                  (merchant.travelDaysTotal - merchant.travelDaysRemaining + dayProgress) /
                    merchant.travelDaysTotal,
                ),
              );
              const travelFactor = VESSEL_CLASSES[merchant.vesselClass].travelFactor;
              const position = toMapPoint(
                getRouteStateAt(merchantRoute, travelProgress, travelFactor).point,
              );
              const inspected = merchant.id === selectedMerchantId;
              return (
                <g
                  key={merchant.id}
                  role={interactive ? "button" : "img"}
                  tabIndex={-1}
                  aria-label={`${merchant.name}, sailing to ${getTown(merchant.destinationPort).name}`}
                  className="npc-traffic"
                  onClick={interactive ? () => selectMerchant(merchant.id) : undefined}
                >
                  {inspected && (
                    <path
                      d={toMapPath(merchantRoute.points)}
                      fill="none"
                      stroke="#f0dfb6"
                      strokeWidth={2 * markerScale}
                      strokeDasharray={`${3 * markerScale} ${8 * markerScale}`}
                      strokeLinecap="round"
                      opacity=".8"
                      aria-hidden="true"
                    />
                  )}
                  <JourneyVehicle
                    route={merchantRoute}
                    progress={travelProgress}
                    travelFactor={travelFactor}
                    vesselClass={merchant.vesselClass}
                    size={0.68 * markerScale}
                  />
                  <circle cx={position.x} cy={position.y} r={Math.max(20 * markerScale, touchRadius)} fill="transparent" pointerEvents="all">
                    <title>
                      {merchant.name}: {getTown(merchant.currentPort).name} to{" "}
                      {getTown(merchant.destinationPort).name}
                    </title>
                  </circle>
                </g>
              );
            })}

          {TOWNS.map((town) => {
            const docked = state.npcMerchants.filter(
              (merchant) => merchant.phase === "docked" && merchant.currentPort === town.id,
            );
            if (docked.length === 0) return null;
            const quay = toMapPoint(PORT_QUAYS[town.id]);
            const shownShips = docked.slice(0, DOCKED_SHIPS_SHOWN);
            const shipX = (index: number) => quay.x + (28 + index * DOCKED_SHIP_SPACING) * markerScale;
            const shipY = (index: number) => quay.y + (14 + (index % 2) * 7) * markerScale;
            const groupWidth = Math.max(
              touchRadius * 2,
              shipX(shownShips.length - 1) - shipX(0) + 28 * markerScale,
            );
            const groupCentre = (shipX(0) + shipX(shownShips.length - 1)) / 2;
            const onlyMerchant = docked.length === 1 ? docked[0] : null;
            return (
              <g key={`docked-${town.id}`} className="npc-docked">
                {shownShips.map((merchant, index) => (
                  <g
                    key={merchant.id}
                    role={interactive && !touchScreen ? "button" : undefined}
                    tabIndex={interactive && !touchScreen ? -1 : undefined}
                    aria-label={touchScreen ? undefined : `${merchant.name}, in port at ${town.name}`}
                    onClick={interactive && !touchScreen ? () => selectMerchant(merchant.id) : undefined}
                  >
                    <BengalTradingVessel
                      x={shipX(index)}
                      y={shipY(index)}
                      vesselClass={merchant.vesselClass}
                      size={0.58 * markerScale}
                    />
                    {!touchScreen && (
                      <circle cx={shipX(index)} cy={shipY(index)} r={14 * markerScale} fill="transparent" pointerEvents="all">
                        <title>{merchant.name}, in port at {town.name}</title>
                      </circle>
                    )}
                  </g>
                ))}
                {docked.length > DOCKED_SHIPS_SHOWN && (
                  <text
                    className="npc-docked-more"
                    x={shipX(DOCKED_SHIPS_SHOWN)}
                    y={quay.y + 20 * markerScale}
                    fontSize={11 * markerScale}
                    aria-hidden="true"
                  >
                    +{docked.length - DOCKED_SHIPS_SHOWN}
                  </text>
                )}
                {touchScreen && interactive && (
                  <rect
                    className="npc-dock-target"
                    role="button"
                    tabIndex={-1}
                    aria-label={
                      onlyMerchant
                        ? `${onlyMerchant.name}, in port at ${town.name}`
                        : `${docked.length} merchants in port at ${town.name}`
                    }
                    x={groupCentre - groupWidth / 2}
                    y={shipY(0) + 3 * markerScale - touchRadius}
                    width={groupWidth}
                    height={touchRadius * 2}
                    fill="transparent"
                    pointerEvents="all"
                    onClick={() =>
                      onlyMerchant ? selectMerchant(onlyMerchant.id) : selectDock(town.id)
                    }
                  />
                )}
              </g>
            );
          })}

          {fleetShips.map((entry, index) => {
            const trip = getFleetShipRoute(state, entry);
            const position = toMapPoint(PORT_QUAYS[entry.currentPort]);
            return (
              <g key={entry.id} role="img" className="fleet-traffic" aria-label={`Your ship ${entry.name}`}>
                {trip ? (
                  <JourneyVehicle
                    route={trip.route}
                    progress={trip.progress}
                    travelFactor={VESSEL_CLASSES[entry.vesselClass].travelFactor}
                    vesselClass={entry.vesselClass}
                    size={0.72 * markerScale}
                  />
                ) : (
                  <BengalTradingVessel
                    x={position.x + (-26 - index * 14) * markerScale}
                    y={position.y + 10 * markerScale}
                    vesselClass={entry.vesselClass}
                    size={0.72 * markerScale}
                  />
                )}
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
              {route && (
                <JourneyVehicle
                  route={route}
                  progress={progress}
                  travelFactor={selectedVessel.travelFactor}
                  vesselClass={selectedVessel.id}
                  size={markerScale}
                />
              )}
            </>
          )}
          {!state.voyage && (
            <BengalTradingVessel
              x={homePoint.x}
              y={homePoint.y}
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
