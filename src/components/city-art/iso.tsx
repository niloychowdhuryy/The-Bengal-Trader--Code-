// Small isometric drawing kit shared by every town. +u runs down-right, +v runs
// down-left and z is height. Light comes from the upper left, so faces on the v side
// are lit and faces on the u side are in shade.

export const INK = "#2f1d10";

export function iso(u: number, v: number, z = 0): [number, number] {
  return [(u - v) * 0.866, (u + v) * 0.5 - z];
}

function polygon(points: [number, number][]): string {
  return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
}

export interface BoxProps {
  u: number;
  v: number;
  w: number;
  d: number;
  h: number;
  z?: number;
  lit?: string;
  shade?: string;
  top?: string;
  stroke?: number;
}

/** Solid block with footprint (u, v)–(u+w, v+d). */
export function Box({
  u,
  v,
  w,
  d,
  h,
  z = 0,
  lit = "#e3cfa2",
  shade = "#b9986a",
  top,
  stroke = 1.6,
}: BoxProps) {
  return (
    <g stroke={INK} strokeWidth={stroke} strokeLinejoin="round">
      <path
        d={polygon([iso(u, v + d, z), iso(u + w, v + d, z), iso(u + w, v + d, z + h), iso(u, v + d, z + h)])}
        fill={lit}
      />
      <path
        d={polygon([iso(u + w, v + d, z), iso(u + w, v, z), iso(u + w, v, z + h), iso(u + w, v + d, z + h)])}
        fill={shade}
      />
      {top && (
        <path
          d={polygon([iso(u, v, z + h), iso(u + w, v, z + h), iso(u + w, v + d, z + h), iso(u, v + d, z + h)])}
          fill={top}
        />
      )}
    </g>
  );
}

/** Soft cast shadow falling toward the lower right. */
export function GroundShadow({
  u,
  v,
  w,
  d,
  reach = 22,
}: {
  u: number;
  v: number;
  w: number;
  d: number;
  reach?: number;
}) {
  return (
    <path
      d={polygon([iso(u + w * 0.25, v + d), iso(u + w, v + d), iso(u + w + reach, v + d), iso(u + w + reach, v - 2), iso(u + w, v)])}
      fill="#16200f"
      opacity=".3"
    />
  );
}

/** A two-sloped roof with a curved ridge, in the manner of Bengal's bent-roof huts. */
export function ChalaRoof({
  u,
  v,
  w,
  d,
  z,
  rise = 22,
  over = 6,
  curve = 7,
  lit = "#c39a56",
  shade = "#8d6a36",
  line = "#6b4e24",
  strokes = 7,
}: {
  u: number;
  v: number;
  w: number;
  d: number;
  z: number;
  rise?: number;
  over?: number;
  curve?: number;
  lit?: string;
  shade?: string;
  line?: string;
  strokes?: number;
}) {
  const eaveA = iso(u - over, v + d + over, z - 2);
  const eaveB = iso(u + w + over, v + d + over, z - 2);
  const eaveMid = iso(u + w / 2, v + d + over, z - 2 + curve * 0.7);
  const ridgeA = iso(u - over, v + d / 2, z + rise);
  const ridgeB = iso(u + w + over, v + d / 2, z + rise);
  const ridgeMid = iso(u + w / 2, v + d / 2, z + rise + curve);
  const backEave = iso(u + w + over, v - over, z - 2);
  const hatch = Array.from({ length: strokes }, (_, index) => {
    const t = (index + 1) / (strokes + 1);
    const curveLift = 4 * t * (1 - t);
    const top = iso(u - over + (w + over * 2) * t, v + d / 2, z + rise + curve * curveLift);
    const bottom = iso(u - over + (w + over * 2) * t, v + d + over, z - 2 + curve * 0.7 * curveLift);
    return `M${top[0].toFixed(1)} ${top[1].toFixed(1)}L${bottom[0].toFixed(1)} ${bottom[1].toFixed(1)}`;
  }).join("");
  return (
    <g stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
      <path
        d={`M${ridgeB[0]} ${ridgeB[1]}L${backEave[0]} ${backEave[1]}L${eaveB[0]} ${eaveB[1]}Z`}
        fill={shade}
      />
      <path
        d={`M${ridgeA[0]} ${ridgeA[1]}Q${ridgeMid[0]} ${ridgeMid[1] - curve} ${ridgeB[0]} ${ridgeB[1]}L${eaveB[0]} ${eaveB[1]}Q${eaveMid[0]} ${eaveMid[1] - curve * 0.7} ${eaveA[0]} ${eaveA[1]}Z`}
        fill={lit}
      />
      <path d={hatch} fill="none" stroke={line} strokeWidth="1" opacity=".75" />
      <path
        d={`M${ridgeA[0]} ${ridgeA[1]}Q${ridgeMid[0]} ${ridgeMid[1] - curve} ${ridgeB[0]} ${ridgeB[1]}`}
        fill="none"
        stroke="#f3dfae"
        strokeWidth="1.4"
        opacity=".85"
      />
    </g>
  );
}

/** Flat parapet roof seen from above. */
export function FlatRoof({
  u,
  v,
  w,
  d,
  z,
  fill = "#d9c290",
}: {
  u: number;
  v: number;
  w: number;
  d: number;
  z: number;
  fill?: string;
}) {
  return (
    <Box u={u - 2} v={v - 2} w={w + 4} d={d + 4} h={4} z={z} lit="#f0dfb6" shade="#c4a877" top={fill} stroke={1.3} />
  );
}

/** Arch-headed opening on the lit face (at v + d) or the shaded face (at u + w). */
export function Arch({
  face,
  along,
  fixed,
  z = 0,
  width = 10,
  height = 18,
  fill = "#3e2716",
}: {
  face: "lit" | "shade";
  along: number;
  fixed: number;
  z?: number;
  width?: number;
  height?: number;
  fill?: string;
}) {
  const at = (t: number, up: number) =>
    face === "lit" ? iso(along + t, fixed, z + up) : iso(fixed, along + t, z + up);
  const [ax, ay] = at(0, 0);
  const [bx, by] = at(width, 0);
  const [cx, cy] = at(width, height * 0.66);
  const [dx, dy] = at(0, height * 0.66);
  const [tx, ty] = at(width / 2, height * 1.04);
  return (
    <path
      d={`M${ax} ${ay}L${bx} ${by}L${cx} ${cy}Q${tx} ${ty} ${dx} ${dy}Z`}
      fill={fill}
      stroke="#f3dfae"
      strokeWidth="1"
    />
  );
}

export function Dome({
  x,
  y,
  r,
  fill = "#ecdcb6",
}: {
  x: number;
  y: number;
  r: number;
  fill?: string;
}) {
  return (
    <g stroke={INK} strokeWidth="1.5">
      <path d={`M${x - r} ${y}A${r} ${r * 1.08} 0 0 1 ${x + r} ${y}Q${x} ${y + r * 0.42} ${x - r} ${y}Z`} fill={fill} />
      <path d={`M${x + r * 0.28} ${y - r * 0.98}Q${x + r * 1.02} ${y - r * 0.5} ${x + r} ${y}Q${x + r * 0.6} ${y + r * 0.26} ${x + r * 0.28} ${y + r * 0.3}Q${x + r * 0.72} ${y - r * 0.4} ${x + r * 0.28} ${y - r * 0.98}Z`} fill="#b9986a" stroke="none" opacity=".7" />
      <path d={`M${x} ${y - r * 1.08}v${-r * 0.46}`} fill="none" stroke="#7d5f26" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={x} cy={y - r * 1.58} r={r * 0.1} fill="#c9a152" />
    </g>
  );
}

export function Sack({ x, y, fill = "#d4b888", scale = 1 }: { x: number; y: number; fill?: string; scale?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${scale})`}
      d="M-6 3q-2-8 3-10l-1-3 5 1 4-2-1 4q5 3 3 10-6 4-13 0Z"
      fill={fill}
      stroke={INK}
      strokeWidth="1.1"
    />
  );
}

export function Barrel({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} stroke={INK} strokeWidth="1.1">
      <path d="M-5-9q5-2 10 0 2 5 0 10-5 2-10 0-2-5 0-10Z" fill="#94643a" />
      <ellipse cx="0" cy="-9" rx="5" ry="1.8" fill="#c99458" />
      <path d="M-6-5q6 2 12 0m-12 4q6 2 12 0" fill="none" />
    </g>
  );
}

export function Figure({
  x,
  y,
  cloth = "#a8452a",
  head = "#7b4f2f",
  carrying,
  className,
  delay,
}: {
  x: number;
  y: number;
  cloth?: string;
  head?: string;
  carrying?: boolean;
  className?: string;
  delay?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <g className={className} style={delay ? { animationDelay: delay } : undefined}>
        <ellipse cx="4" cy="1" rx="7" ry="2.4" fill="#16200f" opacity=".32" />
        <path d="M-4-1q0-9 2-14 2-2 4 0 2 5 2 14-4 2-8 0Z" fill={cloth} stroke={INK} strokeWidth=".9" />
        <circle cy="-18.5" r="3.1" fill={head} stroke={INK} strokeWidth=".8" />
        {carrying && <path d="M-5-23q5-5 10 0-5 3-10 0Z" fill="#d4b888" stroke={INK} strokeWidth=".8" />}
      </g>
    </g>
  );
}
