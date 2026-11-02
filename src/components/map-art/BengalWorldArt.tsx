import { useId } from "react";
import {
  RIVER_EDGES,
  riverPointsToSvgPath,
} from "../../game/navigation";

const WOODLAND = [
  [42, 127, 0.76], [76, 146, 0.62], [116, 113, 0.82], [151, 129, 0.55],
  [527, 90, 0.79], [568, 118, 0.94], [604, 154, 0.72], [550, 185, 0.58],
  [590, 221, 0.81], [38, 402, 0.64], [80, 427, 0.83], [116, 450, 0.56],
  [566, 465, 0.78], [603, 487, 0.94], [546, 521, 0.65], [595, 553, 0.75],
  [53, 622, 0.85], [95, 649, 0.65], [151, 669, 0.8], [465, 628, 0.69],
  [506, 668, 0.9], [563, 634, 0.72], [607, 688, 0.88], [352, 88, 0.52],
] as const;

const GROVES = [
  [195, 175, 0.42], [218, 183, 0.35], [185, 195, 0.31], [435, 201, 0.39],
  [457, 212, 0.34], [439, 225, 0.28], [162, 350, 0.4], [186, 358, 0.3],
  [194, 371, 0.35], [454, 338, 0.4], [478, 348, 0.31], [490, 363, 0.37],
  [225, 492, 0.38], [247, 503, 0.32], [264, 510, 0.28], [414, 535, 0.4],
  [438, 547, 0.32], [455, 559, 0.37],
] as const;

function Canopy({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="1" cy="8" rx="23" ry="10" fill="#435b3d" opacity=".22" />
      <path d="M-19 2q-9-9 0-17 1-13 13-13 9-12 20-3 15-1 16 12 12 9 2 19-1 13-15 13-9 8-18-1-12 4-18-10Z" fill="#536f46" stroke="#435b3d" strokeWidth="1.8" />
      <path d="M-13-7q-2-12 10-16 9-7 16 1 11-2 14 9-5 10-15 10-12 9-23 0Z" fill="#718452" />
      <path d="M-11-8q8-11 20-8m-14 16q10-8 20-6M-1-19q-4 9 1 17m7-16q-5 7-2 14" fill="none" stroke="#a2a16a" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
      <path d="M0 5v8" stroke="#8a6544" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function WoodlandCluster({ trees }: { trees: readonly (readonly [number, number, number])[] }) {
  return (
    <g aria-hidden="true">
      {trees.map(([x, y, scale], index) => (
        <Canopy key={index} x={x} y={y} scale={scale} />
      ))}
    </g>
  );
}

function Paddy({ x, y, width, height, turn = 0 }: { x: number; y: number; width: number; height: number; turn?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`} aria-hidden="true">
      <path d={`M0 ${height * .2}q${width * .2} -${height * .3} ${width} 0l-${width * .12} ${height * .75}q-${width * .35} ${height * .18} -${width * .88} 0Z`} fill="#b9bb78" stroke="#8a9665" strokeWidth="2" />
      {Array.from({ length: 5 }, (_, index) => (
        <path
          key={index}
          d={`M${width * (.12 + index * .12)} ${height * .14}q${width * .12} ${height * .2} ${width * .04} ${height * .62}`}
          fill="none"
          stroke={index % 2 === 0 ? "#d9ca88" : "#91a16b"}
          strokeWidth="2"
          opacity=".74"
        />
      ))}
    </g>
  );
}

function Riverbank({
  d,
  width,
  className,
}: {
  d: string;
  width: number;
  className: string;
}) {
  return (
    <path
      d={d}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={width}
      className={className}
    />
  );
}

function Rivers({ uniqueId }: { uniqueId: string }) {
  return (
    <g className="world-rivers" aria-label="Rivers and wetlands">
      <g className="minor-waterways" aria-hidden="true">
        <Riverbank d="M18 238C79 215 105 205 151 229S230 257 270 153" width={13} className="creek-bank" />
        <Riverbank d="M18 238C79 215 105 205 151 229S230 257 270 153" width={9} className="creek-water" />
        <Riverbank d="M622 254C559 245 528 215 480 192S397 183 322 221" width={13} className="creek-bank" />
        <Riverbank d="M622 254C559 245 528 215 480 192S397 183 322 221" width={9} className="creek-water" />
        <Riverbank d="M36 477C104 462 151 421 202 386S274 319 334 275" width={12} className="creek-bank" />
        <Riverbank d="M36 477C104 462 151 421 202 386S274 319 334 275" width={8} className="creek-water" />
        <Riverbank d="M624 594C566 565 528 519 486 484S437 408 410 328" width={14} className="creek-bank" />
        <Riverbank d="M624 594C566 565 528 519 486 484S437 408 410 328" width={9} className="creek-water" />
        <Riverbank d="M17 654C85 628 143 589 197 554S282 492 350 470" width={12} className="creek-bank" />
        <Riverbank d="M17 654C85 628 143 589 197 554S282 492 350 470" width={8} className="creek-water" />
        <Riverbank d="M607 51C567 72 540 93 516 107S486 123 465 132" width={11} className="creek-bank" />
        <Riverbank d="M607 51C567 72 540 93 516 107S486 123 465 132" width={7} className="creek-water" />
      </g>
      <g aria-hidden="true">
        {RIVER_EDGES.map((edge) => {
          const d = riverPointsToSvgPath(edge.points);
          return (
            <g key={edge.id}>
              <Riverbank d={d} width={43} className="navigable-river-shadow" />
              <Riverbank d={d} width={38} className="navigable-river-bank" />
              <Riverbank d={d} width={32} className="navigable-river-water" />
              <Riverbank d={d} width={23} className="navigable-river-light" />
              <Riverbank d={d} width={1.6} className="navigable-river-current" />
            </g>
          );
        })}
      </g>
      <g className="water-etchings" aria-hidden="true">
        <path d="M18 264q22-7 43 0m-16 10q20-6 39 1M555 283q24-8 47 0m-35 12q17-5 34 1M39 511q23-7 48 0m-24 13q16-5 34 0M542 607q21-7 39 0m-34 12q20-6 36 0" />
        <path d="M256 246q11-4 22 0m85 69q13-5 25 0m61 55q12-4 24 1m-190-65q12-4 22 0" />
      </g>
      <path d="M0 0h640v720H0z" fill={`url(#map-grain-${uniqueId})`} pointerEvents="none" />
    </g>
  );
}

function Settlement({ x, y, scale = 1, market = false }: { x: number; y: number; scale?: number; market?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <ellipse cx="0" cy="37" rx="75" ry="20" fill="#4a6047" opacity=".16" />
      <path d="M-81 32q26-10 51 0t52 0q25-9 52 1" fill="none" stroke="#a28d60" strokeWidth="6" strokeLinecap="round" opacity=".8" />
      <path d="M-66 26v-31l31-19 30 18v32Zm59 7V-2l34-22 34 22v35Z" fill="#dfc99a" stroke="#806044" strokeWidth="3" />
      <path d="m-73-7 38-25 38 25-8 9-30-20-30 20Zm52 9 38-25 39 25-9 10L17-27-12 12Z" fill="#925e40" stroke="#754a35" strokeWidth="3" strokeLinejoin="round" />
      <path d="M-42 31V11q8-17 16 0v20m38 2V13q9-17 18 0v20" fill="#74523d" stroke="#ad8053" strokeWidth="2" />
      <path d="M-59 5h9v9h-9Zm49 2h10v9h-10Zm55 0h10v9h-10Z" fill="#92a68d" stroke="#79593e" strokeWidth="1.5" />
      <path d="M-88 38h178m-148 6h128" stroke="#8a744d" strokeWidth="2" opacity=".68" />
      {market && (
        <g transform="translate(7 -48)">
          <path d="M-25 17h51V-7h-51Z" fill="#d8bd88" stroke="#80583b" strokeWidth="2" />
          <path d="m-30-6 5-15h50l5 15Z" fill="#ad6745" stroke="#744b37" strokeWidth="2" />
          <path d="M-19-19v13m19-13v13m19-13v13" stroke="#f0d7aa" strokeWidth="5" />
        </g>
      )}
      <path d="M-96 49q31-7 61 0t61 0q27-6 66 0" fill="none" stroke="#73845a" strokeWidth="3" strokeLinecap="round" />
      <Canopy x={-70} y={-21} scale={0.53} />
      <Canopy x={76} y={-15} scale={0.58} />
    </g>
  );
}

export default function BengalWorldArt() {
  const uniqueId = useId().replace(/:/g, "");

  return (
    <g className="bengal-world-art" aria-hidden="true">
      <defs>
        <linearGradient id={`floodplain-${uniqueId}`} x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#d6d2a4" />
          <stop offset=".48" stopColor="#c6ca91" />
          <stop offset="1" stopColor="#b6bc82" />
        </linearGradient>
        <linearGradient id={`highland-${uniqueId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8e9f71" />
          <stop offset=".55" stopColor="#aab282" />
          <stop offset="1" stopColor="#bbc08b" />
        </linearGradient>
        <linearGradient id={`tidal-land-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9c48e" />
          <stop offset=".52" stopColor="#aeb282" />
          <stop offset="1" stopColor="#899b74" />
        </linearGradient>
        <pattern id={`map-grain-${uniqueId}`} width="38" height="38" patternUnits="userSpaceOnUse">
          <path d="M3 9q10-3 18 1m8 18q5-2 8 0M8 34q5-2 10 0" fill="none" stroke="#f7edc9" strokeWidth="1" opacity=".21" />
          <circle cx="27" cy="7" r="1.1" fill="#786f4e" opacity=".18" />
          <circle cx="18" cy="21" r=".9" fill="#fff5da" opacity=".38" />
        </pattern>
        <pattern id={`reed-texture-${uniqueId}`} width="27" height="25" patternUnits="userSpaceOnUse">
          <path d="M4 23q4-11 0-18m9 18q2-9 8-16m2 16q2-7 4-10" fill="none" stroke="#687d53" strokeWidth="1.5" opacity=".48" />
          <path d="M2 14q3-5 5 0m7 4q4-6 7 0" fill="none" stroke="#ddc785" strokeWidth="1.2" opacity=".7" />
        </pattern>
        <filter id={`land-shadow-${uniqueId}`} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <rect width="640" height="720" fill={`url(#floodplain-${uniqueId})`} />

      <g aria-hidden="true">
        <path d="M0 0h640v84q-48 24-99 4t-100 13q-66 31-133 4T177 96q-79 32-177-2Z" fill={`url(#highland-${uniqueId})`} />
        <path d="M0 86q74-30 143-2t135 7q67-26 128 5t130-2q58-19 104 3v43q-59-20-113 8t-125 2q-74-26-131 6t-129 1Q63 133 0 165Z" fill="#9ca979" opacity=".7" />
        <path d="M0 568q57-29 111-2t109 2q76-32 145-2t127 8q71-23 148 7v139H0Z" fill={`url(#tidal-land-${uniqueId})`} />
        <path d="M0 596q82-31 160 1t157-3q72-27 139 4t184-5M0 634q62-24 123 1t129 2q82-27 151 4t142-2" fill="none" stroke="#d9cd98" strokeWidth="3" opacity=".47" />

        <path d="M28 310q41-29 87-12t81-1q37 17 74 0t77 8q30 16 58 2t59-3q39 17 81-3v111q-38 17-76 1t-69 1q-42 21-76 1t-72 0q-50-19-91 2t-82-2q-34-18-51-6Z" fill="#aeb783" opacity=".58" />
        <path d="M17 465q62-31 120-2t113-1q49-26 106-2t98 0q54-23 112 4v77q-47 19-102 0t-103 6q-61 20-119-1t-106 0q-70-20-119 5Z" fill="#d4cb97" opacity=".74" />
        <path d="M17 465q62-31 120-2t113-1q49-26 106-2t98 0q54-23 112 4" fill="none" stroke="#e7d9a8" strokeWidth="3" opacity=".64" />

        <path d="M20 282q55-22 105-2t91 0m-191 13q63-21 117 2t90 0M40 435q56-20 112 1t103-2m-87 84q55-20 104 0t100-3m190-17q35-16 68 0t59 0" fill="none" stroke="#72865d" strokeWidth="2.2" strokeLinecap="round" opacity=".56" />
        <path d="M17 284q47-14 88 2t83 0M491 454q45-16 82 1t50 1M80 546q34-13 66 0t61 1" fill="none" stroke="#f0dfa9" strokeWidth="2.4" strokeLinecap="round" opacity=".52" />

        <Paddy x={30} y={195} width={78} height={54} turn={-8} />
        <Paddy x={103} y={244} width={72} height={48} turn={7} />
        <Paddy x={449} y={277} width={91} height={56} turn={-9} />
        <Paddy x={420} y={433} width={70} height={48} turn={11} />
        <Paddy x={208} y={596} width={85} height={55} turn={-6} />
        <Paddy x={362} y={650} width={73} height={45} turn={8} />

        <path d="M16 339q12-19 24-1t25-2m541-60q15-18 29 1m-601 214q16-22 30 0t31-1m455 82q14-19 28 1" fill="none" stroke="#748553" strokeWidth="5" strokeLinecap="round" opacity=".55" />
        <path d="M41 343q12-18 23-1m507-61q10-15 20 1m-552 219q12-18 24 1m456 77q11-14 22 1" fill="none" stroke={`url(#reed-texture-${uniqueId})`} strokeWidth="14" opacity=".84" />
      </g>

      <g className="terrain-woodland" aria-hidden="true">
        <WoodlandCluster trees={WOODLAND} />
        <WoodlandCluster trees={GROVES} />
      </g>

      <g className="river-islands" aria-hidden="true">
        <path d="M215 237q18-17 41-9t33 1q8 11-6 20t-37 5q-26-1-31-17Z" fill="#c6c38c" stroke="#82936d" strokeWidth="2" />
        <Canopy x={230} y={237} scale={0.44} />
        <Canopy x={258} y={242} scale={0.35} />
        <path d="M426 287q14-14 31-7t22 1q8 10-6 15t-28 2q-16-1-19-11Z" fill="#c4c08a" stroke="#84936d" strokeWidth="2" />
        <Canopy x={441} y={291} scale={0.35} />
        <Canopy x={465} y={292} scale={0.29} />
        <path d="M464 402q16-16 34-8t20 8q-2 11-17 12t-31-3q-11-3-6-9Z" fill="#bdbd87" stroke="#81916b" strokeWidth="2" />
        <Canopy x={479} y={406} scale={0.34} />
        <Canopy x={501} y={411} scale={0.27} />
      </g>

      <Rivers uniqueId={uniqueId} />

      <g className="map-port-settlements">
        <Settlement x={319} y={305} scale={0.72} market />
        <Settlement x={247} y={165} scale={0.58} />
      </g>

      <g className="distant-hills" aria-hidden="true">
        <path d="M514 97q17-45 38 0 18-68 43 0 17-39 39-2v39q-57-21-120 9Z" fill="#6f8666" opacity=".32" />
        <path d="M506 517q23-39 44-1 22-57 48-5 22-37 42 0v45q-63-24-133 5Z" fill="#71866a" opacity=".3" />
      </g>
    </g>
  );
}
