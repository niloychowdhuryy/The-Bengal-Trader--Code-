// Builds the transport network from the painted water, so routes follow what the
// player sees. Rerun when the map painting changes:
//
//   npm i --no-save playwright-core
//   node tools/nav/bake-network.mjs [overlay.png]
//
// Writes src/game/transport-network.data.ts and src/game/__fixtures__/water-mask.json.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readMapPixels, writePng } from "./read-map.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const W = 1365;
const H = 768;
const NAV_X = 1152 / W; // navigation coordinates are 1152 wide; the painting is 1365
const at = (x, y) => y * W + x;

const PORTS = {
  dhaka: [718, 320], sonargaon: [858, 296], kasimbazar: [415, 252], chittagong: [989, 520],
  sylhet: [946, 185], hooghly: [302, 324], satgaon: [420, 374], rajmahal: [493, 105],
  tanda: [489, 179], malda: [620, 171], balasore: [168, 519], jessore: [795, 405],
  sandwip: [795, 540], "bakla-chandradwip": [496, 548], patna: [204, 123],
};
// A town further than this from water (map pixels) gets a cart road from its landing.
const LAND_ACCESS_DISTANCE = 45;
// Hazy blue hills and sky at the top of the painting aren't water.
const isSky = (x, y) => y < 70 || (x >= 770 && x < 1000 && y < 92) || (x >= 1000 && y < 125);
// Thin painted channels the colour test misses, in painting pixels. The radius sets
// how wide the channel counts as, and so which vessels fit.
const BRIDGES = [
  { radius: 3, points: [[957, 265], [977, 250]] }, // inlet beside Sonargaon
  { radius: 4, points: [[688, 118], [720, 117], [765, 117]] }, // channel north of Malda
  // Canal behind Malda: painted only a few pixels wide, so it's always narrow.
  { radius: 2, depth: 1.4, points: [[650, 230], [662, 212], [672, 200], [700, 203], [740, 207], [810, 210], [842, 204]] },
];
// Half-width of a channel in painting pixels, mapped to the game's abstract depth.
const depthFor = (clearance) =>
  clearance >= 9 ? 2.2 : clearance >= 5 ? 1.6 : clearance >= 3 ? 1.5 : clearance >= 1.8 ? 1.4 : 1.3;
// Roads from a town's quay to another landing, in painting pixels. Sonargaon's quay is
// on the river behind the town, but its main waterfront faces Dhaka. Malda's is on a
// narrow canal, so larger boats unload on the channel north of the town.
const TOWN_ROADS = [
  { port: "sonargaon", landing: [930, 352] },
  { port: "malda", landing: [735, 118] },
];

const pixels = await readMapPixels(join(ROOT, "public/images/bengal-world-map.webp"), W, H);
let water = new Uint8Array(W * H);
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    if (isSky(x, y)) continue;
    const o = at(x, y) * 4;
    const [r, g, b] = [pixels[o], pixels[o + 1], pixels[o + 2]];
    const max = Math.max(r, g, b);
    const delta = max - Math.min(r, g, b);
    if (delta < 14) continue;
    const hue = 60 * (max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4);
    if (hue > 165 && hue < 225 && delta / max > 0.14 && b > 64) water[at(x, y)] = 1;
  }
}

function morph(source, radius, value) {
  const out = source.slice();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (source[at(x, y)] === value) continue;
      search: for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const X = x + dx;
          const Y = y + dy;
          if (X >= 0 && Y >= 0 && X < W && Y < H && source[at(X, Y)] === value) {
            out[at(x, y)] = value;
            break search;
          }
        }
      }
    }
  }
  return out;
}
water = morph(morph(water, 3, 1), 3, 0);

const bridgeDepth = new Map();
for (const { radius, points, depth } of BRIDGES) {
  for (let n = 1; n < points.length; n += 1) {
    const [x1, y1] = points[n - 1];
    const [x2, y2] = points[n];
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
    for (let i = 0; i <= steps; i += 1) {
      const x = Math.round(x1 + ((x2 - x1) * i) / steps);
      const y = Math.round(y1 + ((y2 - y1) * i) / steps);
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          water[at(x + dx, y + dy)] = 1;
          if (depth) bridgeDepth.set(at(x + dx, y + dy), depth);
        }
      }
    }
  }
}

function components(source, value) {
  const label = new Int32Array(W * H).fill(-1);
  const sizes = [];
  for (let start = 0; start < W * H; start += 1) {
    if (source[start] !== value || label[start] >= 0) continue;
    const id = sizes.length;
    let count = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const p = stack.pop();
      count += 1;
      const x = p % W;
      for (const t of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (t >= 0 && t < W * H && source[t] === value && label[t] < 0) {
          label[t] = id;
          stack.push(t);
        }
      }
    }
    sizes.push(count);
  }
  return { label, sizes };
}

// Boats and reflections read as small specks of land.
{
  const { label, sizes } = components(water, 0);
  for (let i = 0; i < W * H; i += 1) if (!water[i] && sizes[label[i]] < 70) water[i] = 1;
}
const { label, sizes } = components(water, 1);
const mainId = sizes.indexOf(Math.max(...sizes));
const main = new Uint8Array(W * H);
for (let i = 0; i < W * H; i += 1) if (label[i] === mainId) main[i] = 1;

// Distance from each water pixel to the nearest land.
const clearance = new Float32Array(W * H).fill(1e9);
for (let i = 0; i < W * H; i += 1) if (!main[i]) clearance[i] = 0;
const chamfer = (x, y, dx, dy, cost) => {
  const X = x + dx;
  const Y = y + dy;
  if (X < 0 || Y < 0 || X >= W || Y >= H) return;
  clearance[at(x, y)] = Math.min(clearance[at(x, y)], clearance[at(X, Y)] + cost);
};
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  chamfer(x, y, -1, 0, 1); chamfer(x, y, 0, -1, 1); chamfer(x, y, -1, -1, 1.414); chamfer(x, y, 1, -1, 1.414);
}
for (let y = H - 1; y >= 0; y -= 1) for (let x = W - 1; x >= 0; x -= 1) {
  chamfer(x, y, 1, 0, 1); chamfer(x, y, 0, 1, 1); chamfer(x, y, 1, 1, 1.414); chamfer(x, y, -1, 1, 1.414);
}

// Thin the water to its centre lines (Zhang-Suen).
const skeleton = main.slice();
for (let x = 0; x < W; x += 1) { skeleton[at(x, 0)] = 0; skeleton[at(x, H - 1)] = 0; }
for (let y = 0; y < H; y += 1) { skeleton[at(0, y)] = 0; skeleton[at(W - 1, y)] = 0; }
const RING = [-W, -W + 1, 1, W + 1, W, W - 1, -1, -W - 1];
for (let changed = true; changed; ) {
  changed = false;
  for (const pass of [0, 1]) {
    const remove = [];
    for (let i = W; i < W * (H - 1); i += 1) {
      if (!skeleton[i]) continue;
      const n = RING.map((d) => skeleton[i + d]);
      const count = n.reduce((a, b) => a + b, 0);
      if (count < 2 || count > 6) continue;
      let transitions = 0;
      for (let k = 0; k < 8; k += 1) if (!n[k] && n[(k + 1) % 8]) transitions += 1;
      if (transitions !== 1) continue;
      const blocked = pass === 0
        ? n[0] * n[2] * n[4] || n[2] * n[4] * n[6]
        : n[0] * n[2] * n[6] || n[0] * n[4] * n[6];
      if (!blocked) remove.push(i);
    }
    for (const i of remove) skeleton[i] = 0;
    if (remove.length) changed = true;
  }
}

// Roads prefer open fields and avoid the painted buildings as far as they can.
function roadCost(p) {
  if (water[p]) return 8;
  const o = p * 4;
  const [r, g, b] = [pixels[o], pixels[o + 1], pixels[o + 2]];
  const green = g > r * 0.98 && g > b * 1.15;
  return green ? 1 : 5;
}

function pathThrough(allowed, start, goal, costAt) {
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const heap = [[0, start]];
  const push = (item) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0; ) {
      const j = (i - 1) >> 1;
      if (heap[j][0] <= heap[i][0]) break;
      [heap[i], heap[j]] = [heap[j], heap[i]];
      i = j;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        let m = i;
        const a = 2 * i + 1;
        const b = a + 1;
        if (a < heap.length && heap[a][0] < heap[m][0]) m = a;
        if (b < heap.length && heap[b][0] < heap[m][0]) m = b;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, p] = pop();
    if (p === goal) break;
    if (d > dist.get(p)) continue;
    for (const offset of RING) {
      const t = p + offset;
      if (t < 0 || t >= W * H || !allowed(t)) continue;
      const step = (Math.abs(offset) === 1 || Math.abs(offset) === W ? 1 : 1.414) * costAt(t);
      if (d + step < (dist.get(t) ?? Infinity)) {
        dist.set(t, d + step);
        prev.set(t, p);
        push([d + step, t]);
      }
    }
  }
  if (!prev.has(goal) && start !== goal) return null;
  const path = [goal];
  while (path[path.length - 1] !== start) path.push(prev.get(path[path.length - 1]));
  return path.reverse();
}

// Quays: the nearest properly open water to each town marker.
const ports = Object.entries(PORTS).map(([id, [nx, ny]]) => {
  const x = Math.round(nx / NAV_X);
  const y = ny;
  let quay = -1;
  let best = Infinity;
  for (let dy = -120; dy <= 120; dy += 1) for (let dx = -120; dx <= 120; dx += 1) {
    const X = x + dx;
    const Y = y + dy;
    if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const p = at(X, Y);
    const d = Math.hypot(dx, dy);
    if (main[p] && clearance[p] >= 4 && d < best) { best = d; quay = p; }
  }
  if (quay < 0) throw new Error(`No water near ${id}`);
  return { id, marker: at(x, y), quay, distance: best };
});

const roadLandings = TOWN_ROADS.map(({ port, landing: [x, y] }) => {
  let quay = -1;
  let best = Infinity;
  for (let i = 0; i < W * H; i += 1) {
    if (!main[i] || clearance[i] < 4) continue;
    const d = Math.hypot((i % W) - x, ((i / W) | 0) - y);
    if (d < best) { best = d; quay = i; }
  }
  return { id: `${port}-landing`, port, quay, isRoad: true };
});

// Link each quay to the nearest centre line.
const forced = new Set();
const quayLinks = [];
for (const port of [...ports, ...roadLandings]) {
  let target = -1;
  let best = Infinity;
  for (let i = 0; i < W * H; i += 1) {
    if (!skeleton[i]) continue;
    const d = Math.hypot((i % W) - (port.quay % W), ((i / W) | 0) - ((port.quay / W) | 0));
    if (d < best) { best = d; target = i; }
  }
  const path = pathThrough((t) => main[t] === 1, port.quay, target, () => 1);
  forced.add(target);
  forced.add(port.quay);
  quayLinks.push({ port, path });
}

// Trace the centre lines into a graph.
const neighbours = (p) => RING.map((d) => p + d).filter((t) => skeleton[t]);
const isNodePixel = (p) => forced.has(p) || neighbours(p).length !== 2;
const nodeOf = new Map();
const nodes = [];
for (let i = 0; i < W * H; i += 1) {
  if (!skeleton[i] || !isNodePixel(i) || nodeOf.has(i)) continue;
  const id = nodes.length;
  const cluster = [i];
  nodeOf.set(i, id);
  for (let c = 0; c < cluster.length; c += 1) {
    for (const t of neighbours(cluster[c])) {
      if (isNodePixel(t) && !nodeOf.has(t)) { nodeOf.set(t, id); cluster.push(t); }
    }
  }
  const keep = cluster.find((p) => forced.has(p));
  const meanX = cluster.reduce((s, p) => s + p % W, 0) / cluster.length;
  const meanY = cluster.reduce((s, p) => s + ((p / W) | 0), 0) / cluster.length;
  const centre = keep ?? cluster.reduce((a, b) =>
    Math.hypot(a % W - meanX, ((a / W) | 0) - meanY) <= Math.hypot(b % W - meanX, ((b / W) | 0) - meanY) ? a : b);
  nodes.push({ id, pixel: centre, port: null });
}
let edges = [];
const seen = new Set();
for (const [pixel, id] of nodeOf) {
  for (const first of neighbours(pixel)) {
    if (nodeOf.has(first) || seen.has(first)) continue;
    const path = [nodes[id].pixel, first];
    seen.add(first);
    let previous = first;
    let cameFrom = pixel;
    let end = null;
    for (;;) {
      const next = neighbours(previous).filter((t) => t !== cameFrom && !seen.has(t));
      const closing = neighbours(previous).find((t) => nodeOf.has(t) && t !== pixel);
      if (closing !== undefined) { end = nodeOf.get(closing); break; }
      if (next.length === 0) {
        const back = neighbours(previous).find((t) => nodeOf.has(t));
        end = back === undefined ? null : nodeOf.get(back);
        break;
      }
      seen.add(next[0]);
      cameFrom = previous;
      previous = next[0];
      path.push(previous);
    }
    if (end === null || end === id) continue;
    path.push(nodes[end].pixel);
    edges.push({ from: id, to: end, path, mode: "water" });
  }
}

// Quay spurs.
for (const { port, path } of quayLinks) {
  const hub = nodeOf.get(path[path.length - 1]);
  const quayNode = nodes.length;
  nodes.push({ id: quayNode, pixel: port.quay, port: null });
  if (path.length > 1) edges.push({ from: quayNode, to: hub, path, mode: "water", spur: true });
  port.quayNode = path.length > 1 ? quayNode : hub;
}

// Towns well inland get a land road from their landing to the town.
const edgeLengthOf = (path) => path.slice(1).reduce((s, p, i) => s + Math.hypot(p % W - path[i] % W, ((p / W) | 0) - ((path[i] / W) | 0)), 0);
for (const port of ports) {
  if (port.distance < LAND_ACCESS_DISTANCE) {
    nodes[port.quayNode].port = port.id;
    port.landing = null;
    continue;
  }
  // Stays on land, stepping onto water only for the last few pixels to the mooring.
  const road = pathThrough(
    (t) => !isSky(t % W, (t / W) | 0) && (!water[t] || (main[t] === 1 && clearance[t] <= 6)),
    port.marker,
    port.quay,
    roadCost,
  );
  if (!road) throw new Error(`No land route for ${port.id}`);
  const townNode = nodes.length;
  nodes.push({ id: townNode, pixel: port.marker, port: port.id });
  nodes[port.quayNode].landing = port.id;
  edges.push({ from: townNode, to: port.quayNode, path: road, mode: "land" });
}

for (const landing of roadLandings) {
  const town = ports.find((port) => port.id === landing.port);
  const road = pathThrough(
    (t) => !isSky(t % W, (t / W) | 0) && (!water[t] || (main[t] === 1 && clearance[t] <= 6)),
    town.quay,
    landing.quay,
    roadCost,
  );
  if (!road) throw new Error(`No road for ${landing.id}`);
  nodes[landing.quayNode].landing = landing.port;
  edges.push({ from: town.quayNode, to: landing.quayNode, path: road, mode: "land" });
}

// Remove dead ends that lead to no port, then join nodes that are just bends.
const portNode = (id) => nodes[id].port !== null || nodes[id].landing;
for (let changed = true; changed; ) {
  changed = false;
  const degree = new Map();
  for (const e of edges) { degree.set(e.from, (degree.get(e.from) ?? 0) + 1); degree.set(e.to, (degree.get(e.to) ?? 0) + 1); }
  const kept = edges.filter((e) => {
    const dead = [e.from, e.to].some((n) => degree.get(n) === 1 && !portNode(n));
    if (dead) changed = true;
    return !dead;
  });
  edges = kept;
}
for (let changed = true; changed; ) {
  changed = false;
  const at_ = new Map();
  edges.forEach((e) => { for (const n of [e.from, e.to]) { if (!at_.has(n)) at_.set(n, []); at_.get(n).push(e); } });
  for (const [n, list] of at_) {
    if (list.length !== 2 || portNode(n) || list[0] === list[1]) continue;
    const [a, b] = list;
    if (a.mode !== b.mode) continue;
    const aPath = a.to === n ? a.path : [...a.path].reverse();
    const bPath = b.from === n ? b.path : [...b.path].reverse();
    const from = a.to === n ? a.from : a.to;
    const to = b.from === n ? b.to : b.from;
    if (from === to) continue;
    edges = edges.filter((e) => e !== a && e !== b);
    edges.push({ from, to, path: [...aPath, ...bPath.slice(1)], mode: a.mode, spur: a.spur && b.spur });
    changed = true;
    break;
  }
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  let worst = 0;
  let index = 0;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - points[i][1]) - (a[0] - points[i][0]) * (b[1] - a[1])) / length;
    if (d > worst) { worst = d; index = i; }
  }
  if (worst <= tolerance) return [a, b];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

const used = new Set(edges.flatMap((e) => [e.from, e.to]));
const nodeId = (n) => nodes[n].port ?? (nodes[n].landing ? `${nodes[n].landing}-landing` : `junction-${n}`);
const toNav = (p) => ({ x: Math.round((p % W) * NAV_X * 10) / 10, y: (p / W) | 0 });
const outNodes = [...used].sort((a, b) => a - b).map((n) => ({
  id: nodeId(n),
  point: toNav(nodes[n].pixel),
  ...(nodes[n].port ? { port: nodes[n].port } : {}),
}));
const outEdges = edges.map((e, index) => {
  // A low percentile, because a single misread pixel shouldn't close a whole channel.
  const clear = e.path.slice(5, -5).map((p) => clearance[p]).sort((a, b) => a - b);
  const narrowest = clear.length ? clear[Math.floor(clear.length * 0.15)] : 9;
  const set = e.path.map((p) => bridgeDepth.get(p)).filter(Boolean);
  const measured = e.spur ? 2.2 : depthFor(narrowest);
  const depth = e.mode === "land" ? 0 : set.length > 8 ? Math.min(measured, ...set) : measured;
  return {
    id: `${e.mode}-${index}`,
    from: nodeId(e.from),
    to: nodeId(e.to),
    mode: e.mode,
    minimumDepth: depth,
    points: simplify(e.path.map((p) => [p % W, (p / W) | 0]), 1.2).map(([x, y]) => toNav(at(x, y))),
  };
});
const landings = Object.fromEntries(ports.map((p) => [p.id, toNav(p.quay)]));

writeFileSync(
  join(ROOT, "src/game/transport-network.data.ts"),
  `// Generated by tools/nav/bake-network.mjs from the map painting. Don't edit by hand.\nimport type { TransportEdge, TransportNode } from "./navigation";\nimport type { TownId } from "./model";\n\nexport const TRANSPORT_NODES: TransportNode[] = ${JSON.stringify(outNodes)};\n\nexport const TRANSPORT_EDGES: TransportEdge[] = ${JSON.stringify(outEdges)};\n\n/** Where a ship moors for each town. */\nexport const PORT_QUAYS: Record<TownId, { x: number; y: number }> = ${JSON.stringify(landings)};\n`,
);

// The water map used by tests, stored row by row as run lengths.
const rows = [];
for (let y = 0; y < H; y += 1) {
  const runs = [];
  let value = 0;
  let run = 0;
  for (let x = 0; x < W; x += 1) {
    if (water[at(x, y)] === value) run += 1;
    else { runs.push(run); value = water[at(x, y)]; run = 1; }
  }
  runs.push(run);
  rows.push(runs);
}
writeFileSync(
  join(ROOT, "src/game/__fixtures__/water-mask.json"),
  JSON.stringify({ width: W, height: H, rows }),
);

console.log("nodes", outNodes.length, "edges", outEdges.length, "points", outEdges.reduce((s, e) => s + e.points.length, 0));
console.log("depths", JSON.stringify(outEdges.reduce((m, e) => { m[e.minimumDepth] = (m[e.minimumDepth] ?? 0) + 1; return m; }, {})));
console.log("towns", ports.map((p) => `${p.id}:${Math.round(p.distance)}${p.landing === null ? "" : "(cart)"}`).join(" "));

if (process.argv[2]) {
  const out = pixels.slice();
  const stamp = (x, y, c, r = 1) => { for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) { const o = at(x + dx, y + dy) * 4; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; } };
  const colour = { 2.2: [255, 255, 255], 1.6: [255, 230, 0], 1.5: [255, 140, 0], 1.4: [255, 40, 40], 1.3: [255, 0, 255], 0: [120, 60, 0] };
  outEdges.forEach((e, n) => { for (const p of edges[n].path) stamp(p % W, (p / W) | 0, colour[e.minimumDepth], 1); });
  for (const p of ports) stamp(p.quay % W, (p.quay / W) | 0, [0, 255, 120], 3);
  await writePng(out, W, H, process.argv[2]);
}
