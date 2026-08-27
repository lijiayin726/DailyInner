import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const source =
  "C:/Users/李佳音/.codex/generated_images/01a02391-2323-73c0-9f50-32e87548bc13/call_RvKOtCvJNOwfVDDxSrI3Ffca.png";
const publicIconDir = "static/public/icons";
const safeIcon = path.join(publicIconDir, "dailyinner-icon-source-safe.png");

const legacySizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const foregroundSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

function isLogoPixel(r, g, b, a) {
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  const isBlueGreen = g > 120 && b > 120 && r < 120;
  return a > 20 && saturation > 30 && isBlueGreen;
}

async function extractLogo() {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      if (isLogoPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0) {
    throw new Error("No logo pixels found in source image.");
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const cropped = await sharp(source)
    .extract({ left: minX, top: minY, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < cropped.data.length; offset += 4) {
    const r = cropped.data[offset];
    const g = cropped.data[offset + 1];
    const b = cropped.data[offset + 2];
    if (!isLogoPixel(r, g, b, cropped.data[offset + 3])) {
      cropped.data[offset + 3] = 0;
    }
  }

  return {
    buffer: cropped.data,
    info: cropped.info,
    bounds: { minX, minY, maxX, maxY, width, height },
  };
}

async function makeIcon() {
  fs.mkdirSync(publicIconDir, { recursive: true });
  const logo = await extractLogo();

  const symbolSize = 570;
  const symbol = await sharp(logo.buffer, { raw: logo.info })
    .resize(symbolSize, symbolSize, { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: symbol, left: 227, top: 227 }])
    .png()
    .toFile(safeIcon);

  for (const [density, size] of Object.entries(legacySizes)) {
    const dir = path.join("android/app/src/main/res", `mipmap-${density}`);
    await sharp(safeIcon).resize(size, size, { fit: "cover" }).png().toFile(path.join(dir, "ic_launcher.png"));
    await sharp(safeIcon)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(path.join(dir, "ic_launcher_round.png"));

    const foregroundSize = foregroundSizes[density];
    const foregroundSymbolSize = Math.round(foregroundSize * 0.5);
    const foregroundSymbol = await sharp(logo.buffer, { raw: logo.info })
      .resize(foregroundSymbolSize, foregroundSymbolSize, { fit: "contain" })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: foregroundSize,
        height: foregroundSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .composite([
        {
          input: foregroundSymbol,
          left: Math.round((foregroundSize - foregroundSymbolSize) / 2),
          top: Math.round((foregroundSize - foregroundSymbolSize) / 2),
        },
      ])
      .png()
      .toFile(path.join(dir, "ic_launcher_foreground.png"));
  }

  console.log(
    JSON.stringify(
      {
        safeIcon,
        sourceBounds: logo.bounds,
        symbolSize,
        foregroundRatio: 0.5,
      },
      null,
      2,
    ),
  );
}

makeIcon();
