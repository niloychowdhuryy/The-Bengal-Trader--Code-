import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import CityBuildingArt from "./city-art/CityBuildingArt";
import { Box, ChalaRoof, Figure, GroundShadow, INK } from "./city-art/iso";
import {
  getCityBuilding,
  getCityProfile,
  type CityBuildingDefinition,
  type CityBuildingId,
  type CityBuildingPlacement,
  type CityProfile,
  type CitySetting,
} from "./city-art/city-layout";
import VesselArt from "./map-art/VesselArt";

export type { CityBuildingId } from "./city-art/city-layout";
export { CITY_BUILDINGS } from "./city-art/city-layout";

const SCENE_WIDTH = 1600;
const SCENE_HEIGHT = 1000;
// Land and water run past the plate so tall screens see scenery, not a gap.
const SCENE_TOP = -420;
const SCENE_BOTTOM = 1420;
const PORTRAIT_WIDTH = 800;

interface CitySceneProps {
  townName: string;
  selectedBuilding: CityBuildingId | null;
  onSelectBuilding: (building: CityBuildingId) => void;
}

const SETTING_COLORS: Record<CitySetting, {
  land: [string, string, string];
  field: string[];
  water: [string, string];
  bank: string;
  canopy: [string, string, string];
  roof: "thatch" | "tile";
}> = {
  delta: {
    land: ["#7f9358", "#93a264", "#6f8650"],
    field: ["#7f9c4e", "#a6ab59", "#8aa650", "#b6ad5d"],
    water: ["#5f9c94", "#2f6c6c"],
    bank: "#b79c6c",
    canopy: ["#2f5a35", "#477a43", "#6f9c52"],
    roof: "thatch",
  },
  coast: {
    land: ["#90995f", "#a7a86e", "#847f4f"],
    field: ["#94a457", "#b3ad62", "#88a052", "#c2b36a"],
    water: ["#4f978f", "#1f5b66"],
    bank: "#d9c594",
    canopy: ["#34633a", "#4f8246", "#7ba358"],
    roof: "thatch",
  },
  upland: {
    land: ["#6f8a50", "#83984f", "#5f7a46"],
    field: ["#6f9347", "#93a551", "#7a9c49", "#a6a558"],
    water: ["#6aa49a", "#366f6c"],
    bank: "#a8926a",
    canopy: ["#264f30", "#3b6e3c", "#5f9049"],
    roof: "tile",
  },
  plains: {
    land: ["#a59d67", "#b5a870", "#8e8c59"],
    field: ["#b3a95c", "#c6b566", "#9fa556", "#d0bc6e"],
    water: ["#6da097", "#3b7070"],
    bank: "#c6ad7c",
    canopy: ["#3f6236", "#5b8043", "#86a052"],
    roof: "tile",
  },
};

function seededRandom(seed: number) {
  let state = seed * 2654435 + 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function Tree({ x, y, scale, canopy, kind }: {
  x: number;
  y: number;
  scale: number;
  canopy: [string, string, string];
  kind: number;
}) {
  if (kind === 0) {
    // Palm
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <ellipse cx="14" cy="2" rx="15" ry="5" fill="#16200f" opacity=".28" />
        <path d="M-2 2q6-26 2-54l5 1q4 28-1 53Z" fill="#7a5a38" stroke={INK} strokeWidth="1.1" />
        <g fill={canopy[1]} stroke={INK} strokeWidth=".9">
          <path d="M2-53q-22-12-34 6 18-6 34-6Z" />
          <path d="M2-53q24-12 35 7-18-7-35-7Z" />
          <path d="M2-53q-14-20-30-16 16 3 30 16Z" fill={canopy[2]} />
          <path d="M2-53q14-21 31-15-17 3-31 15Z" fill={canopy[2]} />
          <path d="M2-53q-6 11-17 18 9-10 17-18Zm0 0q8 11 18 18-10-9-18-18Z" />
        </g>
      </g>
    );
  }
  if (kind === 1) {
    // Bamboo clump
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <ellipse cx="9" cy="2" rx="17" ry="5" fill="#16200f" opacity=".26" />
        <path d="M-7 2q-5-30-13-44M0 2q0-34 2-52M7 2q5-30 15-44" fill="none" stroke="#5f7a3a" strokeWidth="2.6" />
        <path d="M-20-44q-14 4-14 15 9 1 18-8 5 12 17 4 11 9 20-1 9 6 15-11-7-13-17-8-5-15-20-8-11-3-19 9Z" fill={canopy[1]} stroke={INK} strokeWidth="1" />
        <path d="M-16-38q6-8 15-7m8 7q6-5 13-2" fill="none" stroke={canopy[2]} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    );
  }
  // Broad shade tree
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="16" cy="3" rx="27" ry="8" fill="#16200f" opacity=".3" />
      <path d="M-5 3 0-24l7 0 3 27Z" fill="#65472c" stroke={INK} strokeWidth="1.1" />
      <path d="M-28-18q-8-15 7-23 2-16 20-13 13-10 25 3 15 2 13 18 8 13-7 21-8 10-23 3-11 7-21-1-11 2-14-8Z" fill={canopy[0]} stroke={INK} strokeWidth="1.2" />
      <path d="M-22-24q-3-12 9-17 4-12 18-9 11-5 17 6 10 3 7 13-11 8-20 2-11 8-21 1-5 5-10 4Z" fill={canopy[1]} />
      <path d="M-14-34q5-8 13-8 5-5 12-1-4 5-11 5-6 5-14 4Z" fill={canopy[2]} />
    </g>
  );
}

function Hut({ x, y, scale, roof, variant }: {
  x: number;
  y: number;
  scale: number;
  roof: "thatch" | "tile";
  variant: number;
}) {
  const tile = roof === "tile" || variant % 3 === 0;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <GroundShadow u={-16} v={-12} w={32} d={24} reach={12} />
      <Box u={-16} v={-12} w={32} d={24} h={14} lit={variant % 2 ? "#dcc595" : "#c9ae7d"} shade="#a0805a" stroke={1.2} />
      <ChalaRoof
        u={-16}
        v={-12}
        w={32}
        d={24}
        z={14}
        rise={12}
        over={4}
        curve={5}
        lit={tile ? "#a85a36" : "#b8924f"}
        shade={tile ? "#723a22" : "#856233"}
        line={tile ? "#5c2c18" : "#6b4e24"}
        strokes={4}
      />
    </g>
  );
}

/** River or sea along the lower edge, and the bank it meets. */
function shoreY(x: number, setting: CitySetting): number {
  const base = setting === "coast" ? 815 : 835;
  return base + Math.sin(x / 190) * 24 + Math.sin(x / 73 + 1) * 7;
}

const CityBackdrop = memo(function CityBackdrop({
  profile,
  uniqueId,
}: {
  profile: CityProfile;
  uniqueId: string;
}) {
  const { setting, seed, layout } = profile;
  const colors = SETTING_COLORS[setting];
  const scenery = useMemo(() => {
    const random = seededRandom(seed);
    const items: { y: number; node: ReactNode }[] = [];
    const clearOfBuildings = (x: number, y: number, margin: number) =>
      layout.every(
        (spot) =>
          Math.abs(x - spot.x) > margin * spot.scale ||
          Math.abs(y - spot.y) > (margin * 0.82) * spot.scale,
      );
    let placed = 0;
    for (let attempt = 0; attempt < 1100 && placed < 138; attempt += 1) {
      const x = random() * SCENE_WIDTH;
      const y = SCENE_TOP + 40 + random() * (850 - SCENE_TOP);
      const depth = 0.72 + (Math.max(0, y) / SCENE_HEIGHT) * 0.55;
      const makeHut = random() < 0.34 && x > 200 && x < 1400;
      const margin = makeHut ? 118 : 104;
      if (y > shoreY(x, setting) - 34 || !clearOfBuildings(x, y, margin)) continue;
      const key = `${attempt}`;
      if (makeHut) {
        items.push({
          y,
          node: <Hut key={key} x={x} y={y} scale={depth * 1.05} roof={colors.roof} variant={attempt} />,
        });
      } else {
        const roll = random();
        const kind =
          setting === "coast"
            ? roll < 0.55 ? 0 : roll < 0.7 ? 1 : 2
            : setting === "plains"
              ? roll < 0.1 ? 0 : roll < 0.25 ? 1 : 2
              : roll < 0.2 ? 0 : roll < 0.45 ? 1 : 2;
        items.push({
          y,
          node: <Tree key={key} x={x} y={y} scale={depth * (0.85 + random() * 0.45)} canopy={colors.canopy} kind={kind} />,
        });
      }
      placed += 1;
    }
    return items.sort((a, b) => a.y - b.y).map((item) => item.node);
  }, [colors, layout, seed, setting]);

  const fields = useMemo(() => {
    const random = seededRandom(seed + 5);
    const patches: ReactNode[] = [];
    [[70, 230], [1290, 190], [40, 560], [1300, 540]].forEach(([left, top], block) => {
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          const x = left + column * 88 - row * 48;
          const y = top + row * 62 + column * 26;
          const color = colors.field[Math.floor(random() * colors.field.length)];
          patches.push(
            <g key={`${block}-${row}-${column}`}>
              <path d={`M${x} ${y}l84 34-46 28-84-34Z`} fill={color} stroke="#5e6f37" strokeWidth="1.8" />
              <path d={`M${x - 16} ${y + 8}l84 34M${x - 32} ${y + 17}l84 34`} stroke="#e0dc98" strokeWidth="1" opacity=".55" />
            </g>,
          );
        }
      }
    });
    return patches;
  }, [colors, seed]);

  const lanes = useMemo(() => {
    const docks = layout.find((spot) => spot.id === "docks")!;
    const market = layout.find((spot) => spot.id === "market")!;
    const town = layout.find((spot) => spot.id === "town")!;
    const hub = { x: (market.x + docks.x) / 2, y: (market.y + docks.y) / 2 + 20 };
    const spoke = (spot: CityBuildingPlacement) =>
      `M${hub.x} ${hub.y}Q${(hub.x + spot.x) / 2 + (spot.y - hub.y) * 0.16} ${(hub.y + spot.y) / 2 + 24} ${spot.x} ${spot.y + 54 * spot.scale}`;
    return [
      `M${docks.x} ${docks.y + 30}Q${(docks.x + hub.x) / 2 + 30} ${(docks.y + hub.y) / 2} ${hub.x} ${hub.y}`,
      ...layout.filter((spot) => spot.id !== "docks").map(spoke),
      `M-20 ${town.y + 150}Q${town.x - 300} ${town.y + 20} ${town.x} ${town.y + 68}T1620 ${town.y + 110}`,
    ].join("");
  }, [layout]);

  const shorePath = useMemo(() => {
    const points: string[] = [];
    for (let x = -20; x <= SCENE_WIDTH + 20; x += 40) {
      points.push(`${x} ${shoreY(x, setting).toFixed(1)}`);
    }
    return `M${points.join("L")}`;
  }, [setting]);

  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={`city-land-${uniqueId}`} x1="0" y1=".2" x2=".2" y2=".75">
          <stop offset="0" stopColor={colors.land[0]} />
          <stop offset=".55" stopColor={colors.land[1]} />
          <stop offset="1" stopColor={colors.land[2]} />
        </linearGradient>
        <linearGradient id={`city-water-${uniqueId}`} gradientUnits="userSpaceOnUse" x1="0" y1="820" x2="0" y2="1150">
          <stop offset="0" stopColor={colors.water[0]} />
          <stop offset="1" stopColor={colors.water[1]} />
        </linearGradient>
        <pattern id={`city-grass-${uniqueId}`} width="62" height="44" patternUnits="userSpaceOnUse">
          <path d="M6 12q3-5 6 0m26 18q3-5 6 0M52 8q2-4 5 0M18 36q3-4 5 0" fill="none" stroke="#3f5a2f" strokeWidth="1.2" opacity=".42" />
          <circle cx="30" cy="10" r="1.2" fill="#f0e6b4" opacity=".4" />
        </pattern>
      </defs>
      <rect y={SCENE_TOP} width={SCENE_WIDTH} height={SCENE_BOTTOM - SCENE_TOP} fill={`url(#city-land-${uniqueId})`} />
      <rect y={SCENE_TOP} width={SCENE_WIDTH} height={SCENE_BOTTOM - SCENE_TOP} fill={`url(#city-grass-${uniqueId})`} />

      {setting === "upland" && (
        <g>
          <path d="M-20-420h1640V130q-90-58-190-28-110-70-230-12-120-66-250 4-110-52-220-6-130-62-250 2-110-54-200 18-110-26-300-8Z" fill="#3f6b45" stroke={INK} strokeWidth="1.5" />
          <path d="M-20-420h1640V70q-120-40-240-4-130-44-260 2-150-46-280 6-140-46-290 0-140-36-290 6Z" fill="#6b8c6a" />
          <path d="M60 110q40-30 70 0m380-20q44-34 90 2m430-4q40-30 84 4m260-10q34-22 66 2" fill="none" stroke="#80a35e" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {fields}

      {/* water */}
      <path d={`${shorePath}V${SCENE_BOTTOM}H-20Z`} fill={`url(#city-water-${uniqueId})`} />
      <path d={shorePath} transform="translate(0 -9)" fill="none" stroke={colors.bank} strokeWidth="24" strokeLinecap="round" />
      <path d={shorePath} transform="translate(0 2)" fill="none" stroke="#5c4a2a" strokeWidth="3" opacity=".55" />
      {setting === "coast" && (
        <path d={shorePath} transform="translate(0 12)" fill="none" stroke="#f4f0d8" strokeWidth="3" strokeDasharray="60 26" opacity=".7" />
      )}
      <path className="city-river-current" d="M60 910q50-14 100 0m140 40q50-14 100 0m160-62q50-14 100 0m170 58q50-14 100 0m140-72q50-14 100 0m130 54q50-14 100 0m-1010 30q44-12 88 0M480 1040q50-14 100 0m120 50q50-14 100 0m-260 70q50-14 100 0m140-20q50-14 100 0" />
      <path className="city-river-current city-river-current-soft" d="M200 880q40-11 80 0m240 96q40-11 80 0m300-104q40-11 80 0m210 112q40-11 80 0m-1070-32q40-11 80 0" />

      {/* lanes */}
      <path d={lanes} fill="none" stroke="#6e5a35" strokeWidth="27" strokeLinecap="round" opacity=".55" />
      <path d={lanes} fill="none" stroke="#d6c08f" strokeWidth="20" strokeLinecap="round" />
      <path d={lanes} fill="none" stroke="#b7a06e" strokeWidth="1.4" strokeDasharray="4 16" strokeLinecap="round" opacity=".7" />

      {scenery}

      {/* moored and passing boats */}
      <g transform="translate(240 882) scale(1.12)">
        <g className="city-boat-bob"><VesselArt vesselClass="river-boat" /></g>
      </g>
      <g transform="translate(1350 880) scale(-1.2 1.2)">
        <g className="city-boat-bob city-boat-bob-slow"><VesselArt vesselClass="patello" /></g>
      </g>
      <g transform="translate(570 890) scale(.9)">
        <g className="city-boat-bob city-boat-bob-slow"><VesselArt vesselClass="bora" /></g>
      </g>
      <g transform="translate(930 1040) scale(-1.4 1.4)">
        <g className="city-boat-bob"><VesselArt vesselClass="river-boat" /></g>
      </g>
    </g>
  );
});

function CityBuildingButton({
  building,
  placement,
  selected,
  onSelect,
}: {
  building: CityBuildingDefinition;
  placement: CityBuildingPlacement;
  selected: boolean;
  onSelect: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={building.name}
      aria-pressed={selected}
      className={`city-building${selected ? " city-building-selected" : ""}`}
      transform={`translate(${placement.x} ${placement.y}) scale(${placement.scale})`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <rect x="-104" y="-96" width="208" height="186" className="building-hit-area" />
      <ellipse cx="0" cy="16" rx="104" ry="62" className="building-ring" />
      <g className="city-building-art">
        <CityBuildingArt id={building.id} />
      </g>
    </g>
  );
}

function CityBuildingLabel({
  building,
  placement,
  selected,
  size,
}: {
  building: CityBuildingDefinition;
  placement: CityBuildingPlacement;
  selected: boolean;
  size: number;
}) {
  const labelWidth = building.name.length * 12.4 + 34;
  const offset = building.id === "docks" ? -66 : 72;
  return (
    <g
      className={`city-building-label${selected ? " city-building-label-selected" : ""}`}
      transform={`translate(${placement.x} ${placement.y + offset * placement.scale}) scale(${size})`}
      aria-hidden="true"
    >
      <path d={`M${-labelWidth / 2} -18q-7 0-10 6l5 12-5 12q3 6 10 6H${labelWidth / 2}q7 0 10-6l-5-12 5-12q-3-6-10-6Z`} />
      <text y="9" textAnchor="middle">{building.name}</text>
    </g>
  );
}

export default function CityScene({
  townName,
  selectedBuilding,
  onSelectBuilding,
}: CitySceneProps) {
  const uniqueId = useId().replace(/:/g, "");
  const profile = getCityProfile(townName);
  const ordered = [...profile.layout].sort((a, b) => a.y - b.y);
  const sceneRef = useRef<HTMLElement>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const { width, height } = scene.getBoundingClientRect();
      setFrame({ width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);
  // Portrait screens show the town at full width and more land and water above and below.
  const aspect = frame.height > 0 ? frame.width / frame.height : 1.6;
  const portrait = aspect < PORTRAIT_WIDTH / SCENE_HEIGHT;
  const viewBox = portrait
    ? `${(SCENE_WIDTH - PORTRAIT_WIDTH) / 2} ${SCENE_HEIGHT / 2 - PORTRAIT_WIDTH / aspect / 2} ${PORTRAIT_WIDTH} ${PORTRAIT_WIDTH / aspect}`
    : `0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`;
  const pixelsPerUnit = portrait && frame.width > 0 ? frame.width / PORTRAIT_WIDTH : 0.75;
  const labelSize = Math.max(1, Math.min(1.5, 14 / (26 * pixelsPerUnit)));

  return (
    <section ref={sceneRef} className="city-scene" aria-label={`${townName} town scene`}>
      <svg
        className="city-illustration"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid slice"
        role="group"
        aria-label={`Illustrated riverside town of ${townName}. Choose a building.`}
      >
        <CityBackdrop profile={profile} uniqueId={uniqueId} />
        <Figure x={720} y={570} cloth="#1f4d40" className="city-person" delay="-2s" />
        <Figure x={900} y={330} cloth="#efe2c4" carrying className="city-person" delay="-6s" />
        {ordered.map((placement) => (
          <CityBuildingButton
            key={placement.id}
            building={getCityBuilding(placement.id)}
            placement={placement}
            selected={selectedBuilding === placement.id}
            onSelect={() => onSelectBuilding(placement.id)}
          />
        ))}
        {ordered.map((placement) => (
          <CityBuildingLabel
            key={placement.id}
            building={getCityBuilding(placement.id)}
            placement={placement}
            selected={selectedBuilding === placement.id}
            size={labelSize}
          />
        ))}
      </svg>
      <div className="city-vignette" aria-hidden="true" />
      <div className="city-scene-stamp" aria-hidden="true">
        <strong>{townName}</strong>
        <span>Illustrated town</span>
      </div>
    </section>
  );
}
