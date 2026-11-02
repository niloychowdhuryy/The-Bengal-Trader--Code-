// Decodes the served map painting in headless Chrome, since no image library is installed.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

export async function readMapPixels(file, width, height) {
  const server = createServer((request, response) => {
    if (request.url === "/map.webp") {
      response.setHeader("content-type", "image/webp");
      response.end(readFileSync(file));
    } else {
      response.setHeader("content-type", "text/html");
      response.end("<!doctype html><title>x</title>");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const base64 = await page.evaluate(async ([w, h]) => {
    const image = new Image();
    image.src = "/map.webp";
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, w, h);
    const bytes = context.getImageData(0, 0, w, h).data;
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    }
    return btoa(binary);
  }, [width, height]);
  await browser.close();
  server.close();
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export async function writePng(pixels, width, height, file) {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const page = await browser.newPage();
  const data = await page.evaluate(([b64, w, h]) => {
    const raw = Uint8ClampedArray.from(atob(b64), (c) => c.charCodeAt(0));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").putImageData(new ImageData(raw, w, h), 0, 0);
    return canvas.toDataURL("image/png");
  }, [Buffer.from(pixels).toString("base64"), width, height]);
  await browser.close();
  const { writeFileSync } = await import("node:fs");
  writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
}
