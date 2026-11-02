// Bakes the map, water, cloud and material textures served from public/images.
// Everything runs on a canvas in headless Chrome, so no image library is needed.
//
//   npm i --no-save playwright-core
//   node tools/art/bake-art.mjs            # all assets
//   node tools/art/bake-art.mjs textures   # only the textures
//
// The source painting is asset-backups/bengal-world-map-master.png.
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright-core";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = join(ROOT, "public/images");
const MASTER = join(ROOT, "asset-backups/bengal-world-map-master.png");
const only = process.argv[2];

const server = createServer((request, response) => {
  if (request.url === "/master.png") {
    response.setHeader("content-type", "image/png");
    response.end(readFileSync(MASTER));
    return;
  }
  response.setHeader("content-type", "text/html");
  response.end("<!doctype html><title>bake</title>");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
page.setDefaultTimeout(0);
await page.goto(base);

function save(name, dataUrl) {
  const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
  writeFileSync(join(OUT, name), bytes);
  console.log(name, `${Math.round(bytes.length / 1024)} KB`);
}

const textures = await page.evaluate(() => {
  function periodicNoise(width, height, cellsX, cellsY, seed) {
    let state = seed;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const grid = Array.from({ length: cellsX * cellsY }, random);
    const smooth = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const u = (x / width) * cellsX;
      const v = (y / height) * cellsY;
      const x0 = Math.floor(u);
      const y0 = Math.floor(v);
      const fx = smooth(u - x0);
      const fy = smooth(v - y0);
      const at = (i, j) =>
        grid[((j + cellsY) % cellsY) * cellsX + ((i + cellsX) % cellsX)];
      const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
      const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
      return top * (1 - fy) + bottom * fy;
    };
  }

  function paint(width, height, shade) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const image = context.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [r, g, b, a = 255] = shade(x, y);
        const offset = (y * width + x) * 4;
        image.data[offset] = r;
        image.data[offset + 1] = g;
        image.data[offset + 2] = b;
        image.data[offset + 3] = a;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  const results = {};

  // Aged paper: broad staining, fine fibres and flecks.
  const stainA = periodicNoise(512, 512, 5, 5, 11);
  const stainB = periodicNoise(512, 512, 13, 13, 12);
  const fibreA = periodicNoise(512, 512, 90, 26, 13);
  const fibreB = periodicNoise(512, 512, 24, 120, 14);
  const grain = periodicNoise(512, 512, 256, 256, 15);
  results["parchment.webp"] = paint(512, 512, (x, y) => {
    const stain = stainA(x, y) * 0.6 + stainB(x, y) * 0.4;
    const fibre = (fibreA(x, y) + fibreB(x, y)) / 2;
    const value = (stain - 0.5) * 20 + (fibre - 0.5) * 11 + (grain(x, y) - 0.5) * 7;
    const fleck = grain(x * 3 % 512, y * 3 % 512) > 0.93 ? -9 : 0;
    return [240 + value + fleck, 227 + value * 1.08 + fleck, 196 + value * 1.28 + fleck];
  }).toDataURL("image/webp", 0.72);

  // Dark oiled teak with long horizontal grain and a few knots of colour.
  const grainLong = periodicNoise(512, 256, 5, 46, 21);
  const grainFine = periodicNoise(512, 256, 18, 180, 22);
  const blotch = periodicNoise(512, 256, 4, 5, 23);
  results["timber.webp"] = paint(512, 256, (x, y) => {
    const warp = blotch(x, y) * 26;
    const ring = Math.sin(((y + warp) / 256) * Math.PI * 2 * 11) * 0.5 + 0.5;
    const value =
      grainLong(x, y) * 0.5 + grainFine(x, y) * 0.3 + ring * 0.2;
    const seam = y % 128 < 2 ? 0.55 : 1;
    const light = (22 + value * 44) * seam;
    return [light * 1.42, light * 0.93, light * 0.56];
  }).toDataURL("image/webp", 0.74);

  // Soft cloud shadows that drift across the land.
  const cloudA = periodicNoise(1024, 512, 5, 3, 31);
  const cloudB = periodicNoise(1024, 512, 13, 7, 32);
  const cloudC = periodicNoise(1024, 512, 29, 15, 33);
  const fractal = (x, y) =>
    cloudA(x, y) * 0.58 + cloudB(x, y) * 0.28 + cloudC(x, y) * 0.14;
  const edge = (t) => Math.max(0, Math.min(1, t));
  results["cloud-shadow.webp"] = paint(1024, 512, (x, y) => {
    const dx = (x - 512) / 512;
    const dy = (y - 256) / 256;
    const falloff = edge(1.1 - Math.hypot(dx, dy));
    const density = edge((fractal(x, y) - 0.46) * 5) * falloff;
    return [18, 30, 38, density * 150];
  }).toDataURL("image/webp", 0.6);
  results["cloud-wisp.webp"] = paint(1024, 512, (x, y) => {
    const dx = (x - 512) / 512;
    const dy = (y - 256) / 256;
    const falloff = edge(1.05 - Math.hypot(dx, dy));
    const density = edge((fractal((x + 300) % 1024, y) - 0.5) * 6) * falloff;
    return [255, 244, 222, density * 175];
  }).toDataURL("image/webp", 0.66);

  return results;
});
for (const [name, data] of Object.entries(textures)) save(name, data);

if (only !== "textures") {
  const map = await page.evaluate(async () => {
    const WIDTH = 3200;
    const source = new Image();
    source.src = "/master.png";
    await source.decode();
    const HEIGHT = Math.round((WIDTH * source.naturalHeight) / source.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, WIDTH, HEIGHT);

    // Painted name plates, in the coordinates of a 1400px-wide copy.
    const K = WIDTH / 1400;
    const plates = [
      [204, 70, 282, 102], [555, 70, 641, 102], [566, 156, 641, 188],
      [758, 163, 836, 195], [1196, 165, 1274, 197], [488, 238, 592, 270],
      [326, 309, 417, 341], [858, 300, 939, 332], [1013, 290, 1109, 322],
      [464, 361, 550, 393], [928, 411, 1011, 443], [179, 514, 268, 546],
      [520, 545, 669, 577], [936, 545, 1029, 577], [1200, 508, 1299, 540],
    ];

    // Exemplar fill: grows inward from the plate edge, copying the closest
    // matching patch of surrounding painting.
    function fillPlate([x0, y0, x1, y1]) {
      const margin = Math.round(70 * K);
      const left = Math.max(0, Math.round(x0 * K) - margin);
      const top = Math.max(0, Math.round(y0 * K) - margin);
      const right = Math.min(WIDTH, Math.round(x1 * K) + margin);
      const bottom = Math.min(HEIGHT, Math.round(y1 * K) + margin);
      const w = right - left;
      const h = bottom - top;
      const image = context.getImageData(left, top, w, h);
      const data = image.data;
      const known = new Uint8Array(w * h).fill(1);
      for (let y = Math.round(y0 * K) - top; y < Math.round(y1 * K) - top; y += 1) {
        for (let x = Math.round(x0 * K) - left; x < Math.round(x1 * K) - left; x += 1) {
          known[y * w + x] = 0;
        }
      }
      const source = known.slice();
      const R = 6;
      const STEP = 3;
      const candidates = [];
      for (let y = R; y < h - R; y += STEP) {
        for (let x = R; x < w - R; x += STEP) {
          let whole = true;
          for (let j = -R; j <= R && whole; j += R) {
            for (let i = -R; i <= R && whole; i += R) {
              if (!source[(y + j) * w + x + i]) whole = false;
            }
          }
          if (whole) candidates.push([x, y]);
        }
      }
      let remaining = known.reduce((sum, value) => sum + (value ? 0 : 1), 0);
      while (remaining > 0) {
        let best = null;
        let bestScore = -1;
        for (let y = R; y < h - R; y += 2) {
          for (let x = R; x < w - R; x += 2) {
            if (known[y * w + x]) continue;
            let around = 0;
            for (let j = -R; j <= R; j += 2) {
              for (let i = -R; i <= R; i += 2) {
                if (known[(y + j) * w + x + i]) around += 1;
              }
            }
            if (around > bestScore) {
              bestScore = around;
              best = [x, y];
            }
          }
        }
        if (!best) break;
        const [cx, cy] = best;
        let match = null;
        let matchCost = Infinity;
        for (const [sx, sy] of candidates) {
          let cost = 0;
          for (let j = -R; j <= R && cost < matchCost; j += 2) {
            for (let i = -R; i <= R; i += 2) {
              const target = (cy + j) * w + cx + i;
              if (!known[target]) continue;
              const a = target * 4;
              const b = ((sy + j) * w + sx + i) * 4;
              const dr = data[a] - data[b];
              const dg = data[a + 1] - data[b + 1];
              const db = data[a + 2] - data[b + 2];
              cost += dr * dr + dg * dg + db * db;
            }
          }
          if (cost < matchCost) {
            matchCost = cost;
            match = [sx, sy];
          }
        }
        for (let j = -R; j <= R; j += 1) {
          for (let i = -R; i <= R; i += 1) {
            const target = (cy + j) * w + cx + i;
            if (known[target]) continue;
            const a = target * 4;
            const b = ((match[1] + j) * w + match[0] + i) * 4;
            data[a] = data[b];
            data[a + 1] = data[b + 1];
            data[a + 2] = data[b + 2];
            known[target] = 1;
            remaining -= 1;
          }
        }
      }
      context.putImageData(image, left, top);
    }
    plates.forEach(fillPlate);

    function hsv(r, g, b) {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      let h = 0;
      if (d > 0) {
        if (max === r) h = ((g - b) / d + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
      }
      return [h * 60, max ? d / max : 0, max / 255];
    }
    function rgb(h, s, v) {
      const c = v * s;
      const hh = (((h % 360) + 360) % 360) / 60;
      const x = c * (1 - Math.abs((hh % 2) - 1));
      const m = v - c;
      const [r, g, b] =
        hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x]
          : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
      return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
    }
    const smooth = (a, b, t) => {
      const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
      return u * u * (3 - 2 * u);
    };
    const band = (h, a, b, c, d) => smooth(a, b, h) * (1 - smooth(c, d, h));

    // Colour grade: chalky jade water, wet forest greens, warm late-afternoon light.
    const image = context.getImageData(0, 0, WIDTH, HEIGHT);
    const pixels = image.data;
    const water = new Uint8ClampedArray(WIDTH * HEIGHT);
    for (let y = 0; y < HEIGHT; y += 1) {
      const fy = y / HEIGHT;
      for (let x = 0; x < WIDTH; x += 1) {
        const offset = (y * WIDTH + x) * 4;
        const [h, s, v] = hsv(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
        const wet = band(h, 165, 180, 225, 245) * smooth(0.18, 0.34, s);
        const leaf = band(h, 58, 72, 150, 170) * smooth(0.1, 0.25, s);
        const straw = band(h, 34, 44, 60, 72);
        const clay = 1 - smooth(22, 40, h) + smooth(335, 350, h);
        water[y * WIDTH + x] = wet * 255;

        const hue =
          h + (wet * (186 - h) * 0.78) + leaf * (h > 85 ? -13 : -6) + straw * -3;
        const saturation =
          s * (1 - wet * 0.47 - leaf * 0.38 - straw * 0.3 - clay * 0.1);
        const seaDepth = wet * smooth(0.55, 1, fy) * 0.16;
        const value =
          v * (1 - wet * (0.2 + seaDepth) - leaf * 0.19 - straw * 0.07 - clay * 0.05);
        let [r, g, b] = rgb(hue, saturation, value);

        // Warm light from the upper left, cooler shade toward the lower right.
        const fx = x / WIDTH;
        const glow = 1 - (fx * 0.55 + fy * 0.45);
        r *= 0.93 + glow * 0.15;
        g *= 0.93 + glow * 0.09;
        b *= 0.97 - glow * 0.07;

        // Gentle S-curve for painterly weight.
        const curve = (c) => {
          const t = Math.max(0, Math.min(1, c / 255));
          return (t * t * (3 - 2 * t) * 0.42 + t * 0.58) * 255;
        };
        pixels[offset] = curve(r);
        pixels[offset + 1] = curve(g);
        pixels[offset + 2] = curve(b);
      }
    }
    context.putImageData(image, 0, 0);

    // Moving light on the water: two ripple plates that cross-fade in the game.
    function periodic(cellsX, cellsY, seed) {
      let state = seed;
      const random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const grid = new Float32Array(cellsX * cellsY).map(random);
      return (u, v) => {
        const px = u * cellsX;
        const py = v * cellsY;
        const x0 = Math.floor(px);
        const y0 = Math.floor(py);
        const fx = px - x0;
        const fy = py - y0;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const at = (i, j) => grid[(j % cellsY) * cellsX + (i % cellsX)];
        return (
          (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) +
          (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy
        );
      };
    }
    const RW = 1600;
    const RH = Math.round((RW * HEIGHT) / WIDTH);
    function ripple(seed) {
      const a = periodic(150, 520, seed);
      const b = periodic(330, 900, seed + 1);
      const swell = periodic(24, 40, seed + 2);
      const out = document.createElement("canvas");
      out.width = RW;
      out.height = RH;
      const outContext = out.getContext("2d");
      const plate = outContext.createImageData(RW, RH);
      const SX = WIDTH / RW;
      const SY = HEIGHT / RH;
      for (let y = 0; y < RH; y += 1) {
        for (let x = 0; x < RW; x += 1) {
          let wet = 255;
          for (let j = -2; j <= 2; j += 2) {
            for (let i = -2; i <= 2; i += 2) {
              const px = Math.max(0, Math.min(WIDTH - 1, Math.round((x + i) * SX)));
              const py = Math.max(0, Math.min(HEIGHT - 1, Math.round((y + j) * SY)));
              wet = Math.min(wet, water[py * WIDTH + px]);
            }
          }
          const n =
            a(x / RW, y / RH) * 0.62 + b(x / RW, y / RH) * 0.38;
          const light = smooth(0.61, 0.76, n) * (0.35 + swell(x / RW, y / RH) * 0.85);
          const offset = (y * RW + x) * 4;
          plate.data[offset] = 255;
          plate.data[offset + 1] = 247;
          plate.data[offset + 2] = 224;
          plate.data[offset + 3] = Math.min(190, light * (wet / 255) * 210);
        }
      }
      outContext.putImageData(plate, 0, 0);
      return out.toDataURL("image/webp", 0.5);
    }

    return {
      "bengal-world-map.webp": canvas.toDataURL("image/webp", 0.8),
      "water-shimmer-a.webp": ripple(41),
      "water-shimmer-b.webp": ripple(87),
    };
  });
  for (const [name, data] of Object.entries(map)) save(name, data);
}

await browser.close();
server.close();
