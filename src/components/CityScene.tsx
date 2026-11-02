import { useId, type KeyboardEvent } from "react";
import CityBuildingArt from "./city-art/CityBuildingArt";
import {
  getCityLayout,
  getCityBuilding,
  type CityBuildingDefinition,
  type CityBuildingId,
  type CityBuildingPlacement,
} from "./city-art/city-layout";

export type { CityBuildingId } from "./city-art/city-layout";
export { CITY_BUILDINGS } from "./city-art/city-layout";

interface CitySceneProps {
  townName: string;
  selectedBuilding: CityBuildingId | null;
  onSelectBuilding: (building: CityBuildingId) => void;
}

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <ellipse cx="0" cy="12" rx="26" ry="11" fill="#334a38" opacity=".22" />
      <path d="M-4 5 0-22l6 27" fill="#79563c" stroke="#624633" strokeWidth="2" />
      <path d="M-23 0q-11-8-4-20 1-15 14-14 8-14 22-4 17-2 17 15 13 9 2 22-3 13-16 12-10 9-21-1-12 5-18-10Z" fill="#536f46" stroke="#3f5b40" strokeWidth="2.2" />
      <path d="M-17-10q0-14 12-19 10-7 18 2 13-2 14 10-7 10-18 9-11 8-22 0Z" fill="#718452" />
      <path d="M-12-10q9-12 19-9m-17 16q9-8 20-6M1-23q-4 9 1 17" fill="none" stroke="#a2a16a" strokeWidth="1.7" strokeLinecap="round" opacity=".76" />
    </g>
  );
}

function VillageHut({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity=".72" aria-hidden="true">
      <ellipse cx="0" cy="27" rx="43" ry="11" fill="#334b38" opacity=".22" />
      <path d="M-34-2 0 12v30l-34-15Z" fill="#d9c596" stroke="#75543c" strokeWidth="2" />
      <path d="M0 12 34-2v29L0 42Z" fill="#bd9869" stroke="#75543c" strokeWidth="2" />
      <path d="m-40-7 40-27 41 18L0 7Z" fill="#886044" stroke="#674a35" strokeWidth="2.5" />
      <path d="M-30-10 0-29 31-15M-26-4 0-21 25-10" fill="none" stroke="#bd8a58" strokeWidth="1.6" />
      <path d="M-13 18v15l13 6V23Z" fill="#74523b" stroke="#e2c99a" strokeWidth="1.5" />
      <path d="M-33 10 0 26m5-12 24-11" stroke="#ead7ad" strokeWidth="1.4" opacity=".7" />
    </g>
  );
}

function Person({ x, y, delay }: { x: number; y: number; delay: string }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <g className="city-person" transform="scale(2.4)" style={{ animationDelay: delay }}>
        <ellipse cx="0" cy="8" rx="5" ry="2.3" fill="#394a37" opacity=".25" />
        <path d="M-3 0q3-4 6 0l4 7q-6 4-14 0Z" fill="#a75e42" stroke="#72513b" strokeWidth="1" />
        <circle cy="-4" r="2.7" fill="#b9845c" />
        <path d="M-3 1-7 5m10-4 4 4M-3 7l-2 4m8-4 2 4" fill="none" stroke="#72513b" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M-5-5q5-4 10 0" fill="none" stroke="#e0c591" strokeWidth="2" />
      </g>
    </g>
  );
}

function CityBackdrop({ uniqueId }: { uniqueId: string }) {
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={`city-land-${uniqueId}`} x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#b5bd91" />
          <stop offset=".52" stopColor="#d0c293" />
          <stop offset="1" stopColor="#899975" />
        </linearGradient>
        <linearGradient id={`city-river-${uniqueId}`} x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" stopColor="#759f96" />
          <stop offset=".46" stopColor="#a8c6b7" />
          <stop offset="1" stopColor="#70978c" />
        </linearGradient>
        <linearGradient id={`city-roof-glow-${uniqueId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dab17a" />
          <stop offset="1" stopColor="#976044" />
        </linearGradient>
        <pattern id={`city-grain-${uniqueId}`} width="38" height="38" patternUnits="userSpaceOnUse">
          <path d="M3 9q12 4 22 0m7 23q-8-3-13 0" fill="none" stroke="#53674c" strokeWidth="1" opacity=".13" />
          <circle cx="18" cy="25" r="1" fill="#fff3d4" opacity=".55" />
        </pattern>
        <filter id={`city-shadow-${uniqueId}`} x="-30%" y="-30%" width="170%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#334638" floodOpacity=".25" />
        </filter>
      </defs>
      <rect width="960" height="1000" fill={`url(#city-land-${uniqueId})`} />
      <path d="M0 0h960v195q-103 42-213 5t-219 15q-124 41-246 2T0 235Z" fill="#91a17d" opacity=".42" />
      <path d="M0 165q105-55 208 3t211-5q113-51 225 3t218-1q55-21 98-5v235q-119-18-213 22t-205-6q-112-46-221 7T0 401Z" fill="#c4b989" opacity=".78" />
      <path d="M0 350q100-39 195 7t196-7q105-45 215 4t214-4q83-29 140 4v252q-101-34-206 6t-204-8q-109-43-216 8T0 617Z" fill="#9aaa7e" opacity=".64" />

      <g fill="none" stroke="#e5d6a8" strokeLinecap="round" opacity=".75">
        <path d="M-40 220q124-52 237 7t236-8q113-51 231 7t228-3" strokeWidth="5" />
        <path d="M-20 588q100-37 194 9t198-7q111-44 222 5t211-4" strokeWidth="4" />
      </g>

      <g className="city-street-network">
        <path d="M-20 436q95-44 172-77 76-31 137 7t141 47q65 7 125-27 90-52 155-7 85 61 174 19 51-22 98 0" />
        <path d="M380 395q45 62 4 118-29 44 12 86 43 43 29 105m292-279q-52 54-22 101t-24 91q-31 37 2 92t-18 105" />
        <path d="M-5 655q83-50 150-18t140 4q74-17 123 26t122 22q73-3 123-43t112-18" />
      </g>
      <g className="city-street-inlay">
        <path d="M-20 436q95-44 172-77 76-31 137 7t141 47q65 7 125-27 90-52 155-7 85 61 174 19 51-22 98 0" />
        <path d="M380 395q45 62 4 118-29 44 12 86 43 43 29 105m292-279q-52 54-22 101t-24 91q-31 37 2 92t-18 105" />
        <path d="M-5 655q83-50 150-18t140 4q74-17 123 26t122 22q73-3 123-43t112-18" />
      </g>

      <g opacity=".86">
        <path d="M74 695q48-34 95-1t91-2m548 6q42-31 86-1t82-4" fill="none" stroke="#738153" strokeWidth="3" />
        <path d="M67 704q52-31 97 1t91-1m551 2q45-30 88 1t80-1" fill="none" stroke="#d0c48d" strokeWidth="2" />
        <path d="M130 729v-27m28 31v-29m638 27v-28m31 29v-29" stroke="#805d40" strokeWidth="3" />
      </g>

      <g className="city-water">
        <path d="M-80 684q143-81 278-28t259-12q135-70 267-9t296-16v290H-80Z" fill={`url(#city-river-${uniqueId})`} />
        <path d="M-80 688q143-81 278-28t259-12q135-70 267-9t296-16" fill="none" stroke="#816d4c" strokeWidth="18" opacity=".63" />
        <path d="M-80 679q143-81 278-28t259-12q135-70 267-9t296-16" fill="none" stroke="#d3c497" strokeWidth="8" opacity=".9" />
        <path className="city-river-current" d="M20 902q36-12 73 0m104 41q41-12 78 1m103-72q39-13 75 0m87 75q42-14 82 0m85-101q36-12 69 1m-739 104q33-11 63 0m595 19q39-12 70 0" />
        <path className="city-river-current city-river-current-soft" d="M95 960q32-11 61 0m152-105q32-10 62 1m178 130q36-12 68 0m135-119q38-11 72 0" />
      </g>

      <g className="city-gardens" aria-hidden="true">
        <path d="M60 282q54-28 102-1t-2 49q-50 24-99-2t-1-46Zm685 185q51-31 100-1t-1 48q-49 25-97-2t-2-45Z" fill="#a9ac76" stroke="#788154" strokeWidth="2" />
        <path d="M76 296q40-23 72-1m-65 18q36-19 67 0m603 172q38-25 71-1m-64 19q36-19 68 1" fill="none" stroke="#d8ca8b" strokeWidth="2" />
      </g>

      <g className="city-vegetation">
        <Tree x={77} y={264} scale={1.03} />
        <Tree x={252} y={233} scale={0.76} />
        <Tree x={424} y={213} scale={0.91} />
        <Tree x={130} y={438} scale={0.78} />
        <Tree x={852} y={294} scale={1.12} />
        <Tree x={763} y={358} scale={0.72} />
        <Tree x={817} y={544} scale={0.84} />
        <Tree x={118} y={581} scale={0.92} />
        <Tree x={235} y={581} scale={0.64} />
        <Tree x={773} y={613} scale={0.69} />
        <Tree x={848} y={680} scale={0.96} />
        <Tree x={230} y={744} scale={0.76} />
        <Tree x={770} y={752} scale={0.72} />
        <path d="M146 736q11-20 23 0m17 6q9-18 19 0m494-10q10-19 21 0m19 4q10-18 20 0" fill="none" stroke="#63804f" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="city-yard-details" aria-hidden="true">
        <path d="M253 356q35-25 70-2m-65 9q28-20 56-1m217-37q28-19 57-1m-47 10q22-15 44-1" fill="none" stroke="#8e8057" strokeWidth="2" opacity=".66" />
        <path d="M247 365v-19m15 17v-22m60 25v-21m401 117v-17m14 19v-22m33 22v-19" stroke="#75593e" strokeWidth="2.4" />
        <path d="M387 484h34v26h-34Zm8-9h18v9h-18Z" fill="#a3764d" stroke="#694a34" strokeWidth="2" />
        <path d="M584 589h38m-32-7 6 7m7-7 6 7m7-7 6 7" fill="none" stroke="#74553b" strokeWidth="3" strokeLinecap="round" />
        <path d="M572 595q17-13 34 0t34 0" fill="none" stroke="#b48b59" strokeWidth="3" />
        <path d="M605 474q8-11 16 0v11h-16Zm20 2q8-11 16 0v9h-16Z" fill="#bf9666" stroke="#806044" strokeWidth="1.6" />
      </g>

      <g className="city-people">
        <path id={`walking-lane-${uniqueId}`} d="M140 421q165-76 304 2t310-8" fill="none" />
        <Person x={230} y={390} delay="-3s" />
        <Person x={467} y={431} delay="-8s" />
        <Person x={700} y={409} delay="-15s" />
        <Person x={432} y={622} delay="-5s" />
        <Person x={611} y={641} delay="-12s" />
      </g>

      <g transform="translate(635 777) rotate(-8)">
        <g className="city-boat-bob">
          <path d="M-61 0q48-12 124-3l-12 24q-43 15-91 2Z" fill="#44352c" stroke="#332d26" strokeWidth="3" />
          <path d="M-50 2q45-8 100-2l-12 15q-35 9-73 1Z" fill="#8f5c3c" stroke="#cf9a60" strokeWidth="2" />
          <path d="M-39 3 35 13m-66-6 55 14" stroke="#d8ab70" strokeWidth="2" />
          <path d="M-10 2v-55m-3 10-33 42h32m6-29 30 29h-29Z" fill="#eee2c3" stroke="#967650" strokeWidth="2" />
          <path d="M-6-44 22-8h-28Z" fill="#c99b5e" stroke="#967650" strokeWidth="1.5" />
        </g>
      </g>
      <g transform="translate(304 743) scale(.58) rotate(9)">
        <g className="city-boat-bob city-boat-bob-slow">
          <path d="M-54 0q48-11 112-2l-11 20q-36 11-81 2Z" fill="#49382c" stroke="#372f26" strokeWidth="3" />
          <path d="M-5 0v-48m-3 8-27 36h27m6-22 25 22H0Z" fill="#f1e4c4" stroke="#92734d" strokeWidth="2" />
        </g>
      </g>

      <rect width="960" height="1000" fill={`url(#city-grain-${uniqueId})`} opacity=".55" />
      <VillageHut x={410} y={350} scale={0.71} />
      <VillageHut x={612} y={347} scale={0.59} />
      <VillageHut x={395} y={604} scale={0.58} />
      <VillageHut x={427} y={715} scale={0.68} />
    </g>
  );
}

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
      <rect x="-84" y="-89" width="168" height="174" rx="20" className="building-hit-area" />
      <g className="city-building-art">
        <CityBuildingArt id={building.id} variation={placement.variation} />
      </g>
      <g className="city-building-label">
        <text x="0" y="88" textAnchor="middle">{building.name}</text>
      </g>
    </g>
  );
}

export default function CityScene({
  townName,
  selectedBuilding,
  onSelectBuilding,
}: CitySceneProps) {
  const uniqueId = useId().replace(/:/g, "");
  const placements = getCityLayout(townName);

  return (
    <section className="city-scene" aria-label={`${townName} town scene`}>
      <div className="city-scene-stamp" aria-hidden="true">
        <span className="city-scene-mark" />
        <span>{townName} · ILLUSTRATED TOWN</span>
      </div>
      <svg
        className="city-illustration"
        viewBox="0 0 960 1000"
        preserveAspectRatio="xMidYMid slice"
        role="group"
        aria-label={`Illustrated riverside town of ${townName}. Choose a building.`}
      >
        <CityBackdrop uniqueId={uniqueId} />
        <g filter={`url(#city-shadow-${uniqueId})`}>
          {placements.map((placement) => {
            const building = getCityBuilding(placement.id);
            return (
              <CityBuildingButton
                key={placement.id}
                building={building}
                placement={placement}
                selected={selectedBuilding === placement.id}
                onSelect={() => onSelectBuilding(placement.id)}
              />
            );
          })}
        </g>
      </svg>
    </section>
  );
}
