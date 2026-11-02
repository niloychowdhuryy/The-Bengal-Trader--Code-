import type { VesselClassId } from "../../game/model";

// Side-on illustrations, origin at the waterline, prow to the right, lit from the
// upper left. Each class keeps a distinct silhouette at small map sizes. The forms
// are inspired by written descriptions of Bengal river craft; they are original
// game art, not reconstructions of documented vessels.

const INK = "#2a1b12";

function Water({ width }: { width: number }) {
  return (
    <g aria-hidden="true">
      <ellipse cx="0" cy="11" rx={width} ry="9" fill="#10262a" opacity=".32" />
      <path
        d={`M${-width} 13q${width / 4}-4 ${width / 2} 0t${width / 2} 0 ${width / 2} 0 ${width / 2} 0`}
        fill="none"
        stroke="#f4eed8"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity=".62"
      />
    </g>
  );
}

function RiverBoat() {
  return (
    <>
      <Water width={60} />
      {/* steering oar */}
      <path d="M-48-14-64 10" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="m-66 7 5 1-3 10-5-1Z" fill="#6b4426" stroke={INK} strokeWidth="1.2" />
      {/* mast and sail */}
      <path d="M8 2V-76" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M-18-68h52" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <path
        className="vessel-sail"
        d="M-16-66q25 7 48 0 7 22 3 47-27 7-55 0-3-25 4-47Z"
        fill="#efe2c4"
        stroke="#7a5a35"
        strokeWidth="1.6"
      />
      <path d="M-14-56q24 6 47 0l1 7q-24 6-49 0Zm-6 21q27 6 55 0l1 7q-27 6-57 0Z" fill="#a8452a" opacity=".86" />
      <path d="M8-64v47" stroke="#b79968" strokeWidth="1" opacity=".8" />
      <path d="M32-66 58-16M-16-66-44-14" stroke="#6a4a2c" strokeWidth="1" opacity=".75" />
      {/* barrel-vaulted mat cabin */}
      <path d="M-40-5q2-23 25-24 22 0 26 24Z" fill="#c89a58" stroke={INK} strokeWidth="1.8" />
      <path d="M-34-7q3-16 19-17 15 0 20 17m-30-1q2-12 10-13m6 0q8 1 11 13" fill="none" stroke="#8c6a35" strokeWidth="1.2" />
      <path d="M-39-5q1-13 11-20" fill="none" stroke="#f0d79c" strokeWidth="1.6" strokeLinecap="round" />
      {/* hull */}
      <path d="M-62-22q5 15 20 19 42 8 80 0 16-4 28-23 2 16-8 30-10 13-27 16-38 8-72 0-17-5-22-20-3-11 1-22Z" fill="#3b2415" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M-56-13q6 12 20 14 40 7 76 0 12-3 21-15-2 8-10 15-40 11-90 2-13-4-17-16Z" fill="#8b5a30" />
      <path d="M-50-5q43 14 92 1m-88 6q42 11 80 1" fill="none" stroke="#c99458" strokeWidth="1.3" opacity=".9" />
      <path d="M-40-3q42 8 80 0" fill="none" stroke="#e8c78c" strokeWidth="1.6" strokeLinecap="round" />
    </>
  );
}

const BORA_OARS = [-36, -22, -8, 6, 20, 34];

function Bora() {
  return (
    <>
      <Water width={70} />
      {/* small rust pennant */}
      <path d="M-8-5V-44" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <path className="vessel-sail" d="M-7-44 20-37-7-29Z" fill="#a8452a" stroke="#5f2413" strokeWidth="1.1" />
      {/* stern awning */}
      <path d="M-58-6q9-17 28-15l1 15Z" fill="#d9c28c" stroke={INK} strokeWidth="1.5" />
      <path d="M-52-8q7-9 17-9" fill="none" stroke="#8c6a35" strokeWidth="1.1" />
      {/* oars and rowers */}
      <g className="vessel-oars">
        {BORA_OARS.map((x) => (
          <g key={x}>
            <path d={`M${x}-5 ${x - 9} 15`} stroke="#2f1d10" strokeWidth="2.1" strokeLinecap="round" />
            <path d={`m${x - 9} 13 3 1-2 6-4-1Z`} fill="#c99458" stroke={INK} strokeWidth=".7" />
          </g>
        ))}
      </g>
      {BORA_OARS.map((x) => (
        <g key={x}>
          <path d={`M${x - 3}-5q3-7 6 0Z`} fill="#b5613a" stroke={INK} strokeWidth=".8" />
          <circle cx={x} cy="-11" r="2.5" fill="#8a5a38" stroke={INK} strokeWidth=".7" />
        </g>
      ))}
      {/* long, narrow, shallow hull */}
      <path d="M-74-12q7 8 22 8h90q20 0 37-13-1 11-11 17-9 6-26 7H-46q-20 0-28-19Z" fill="#3b2415" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M-66-5q7 4 16 4h88q14 0 24-6-4 6-14 8-55 5-98 2-10-1-16-8Z" fill="#a06a38" />
      <path d="M-56 1h92" stroke="#e8c78c" strokeWidth="1.4" strokeLinecap="round" />
    </>
  );
}

function Patello() {
  return (
    <>
      <Water width={66} />
      {/* great square sail on a stout mast */}
      <path d="M-2-6V-92" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M-40-86h78M-42-30h82" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      <path
        className="vessel-sail"
        d="M-38-84q37 8 74 0 8 27 3 53-40 8-80 0-5-26 3-53Z"
        fill="#e7d6b0"
        stroke="#7a5a35"
        strokeWidth="1.8"
      />
      <path d="M-20-82v50m18-49v50M16-82v50" stroke="#b39566" strokeWidth="1.2" opacity=".85" />
      <path d="M-38-60q38 8 76 0" fill="none" stroke="#a8452a" strokeWidth="5" opacity=".78" />
      {/* steering sweep */}
      <path d="M-54-30-76 8" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      <path d="m-79 4 6 2-4 13-6-2Z" fill="#6b4426" stroke={INK} strokeWidth="1.2" />
      {/* thatched deckhouse */}
      <path d="M-58-12V-30h34v18Z" fill="#b08650" stroke={INK} strokeWidth="1.6" />
      <path d="M-64-28q24-18 46 0l-3 4q-20-9-40 0Z" fill="#8f6a36" stroke={INK} strokeWidth="1.6" />
      <path d="M-58-30q18-11 34 0m-26-3q9-5 18 0" fill="none" stroke="#d9b877" strokeWidth="1.1" />
      {/* cargo stacked amidships and forward */}
      <path d="M-16-12v-13h17v13Zm19 0v-17h17v17Zm19 0v-12h15v12Z" fill="#c9a973" stroke={INK} strokeWidth="1.4" />
      <path d="M-16-19h17m2-4h17m2 5h15M-8-25v13m20-17v17m18-12v12" stroke="#7a5a35" strokeWidth="1" />
      {/* bluff, flat, heavy planked hull */}
      <path d="M-68-16q0-2 4-2H58q10 0 11 4l-5 21q-3 11-15 11H-54q-11 0-13-11Z" fill="#3b2415" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M-63-13H62l-2 7H-62Z" fill="#a06a38" />
      <path d="M-62-5H60l-2 7H-60Z" fill="#855428" />
      <path d="M-60 3H58l-3 7q-2 3-7 3H-52q-5 0-7-4Z" fill="#6a4120" />
      <path d="M-62-6H60M-60 2H58" stroke="#2a1b12" strokeWidth="1.2" />
      <path d="M-63-14H62" stroke="#e8c78c" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M-44-12V10m26-22V10M8-12V10m26-22V10" stroke="#2a1b12" strokeWidth=".9" opacity=".55" />
    </>
  );
}

export default function VesselArt({
  vesselClass,
}: {
  vesselClass: VesselClassId;
}) {
  if (vesselClass === "bora") return <Bora />;
  if (vesselClass === "patello") return <Patello />;
  return <RiverBoat />;
}

export function VesselPortrait({
  vesselClass,
  className,
}: {
  vesselClass: VesselClassId;
  className?: string;
}) {
  return (
    <svg
      className={className ?? "vessel-portrait"}
      viewBox="-90 -100 180 128"
      aria-hidden="true"
    >
      <VesselArt vesselClass={vesselClass} />
    </svg>
  );
}
