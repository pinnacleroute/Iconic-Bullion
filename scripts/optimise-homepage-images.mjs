import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const projectRoot = process.cwd();
const sourceRoot = "/Users/amankumarsingh/Downloads/Iconic Bullion Images/Homepage";
const outputRoot = path.join(projectRoot, "public/images/home");

const assets = [
  {
    source: "Homepage Hero Image.png",
    output: "bullion-hero.webp",
    maxWidth: 2000,
    quality: 84
  },
  {
    source: "Own-Brand Bullion Hero Product Shot.png",
    output: "iconic-bullion-feature.webp",
    maxWidth: 1500,
    quality: 84
  },
  {
    source: "Store Pickup : Secure Delivery.png",
    output: "secure-delivery.webp",
    maxWidth: 1100,
    quality: 84
  },
  {
    source: "Trust : Verification.png",
    output: "verification-trust.webp",
    maxWidth: 1100,
    quality: 84
  },
  {
    source: "Wholesale Bullion.png",
    output: "wholesale.webp",
    maxWidth: 1200,
    quality: 84
  },
  {
    source: "Featured Bullion Category_Minted Bars.png",
    output: "minted-bars.webp",
    maxWidth: 1100,
    quality: 84
  },
  {
    source: "Featured Bullion Categories section_Cast Bars.png",
    output: "cast-bars.webp",
    maxWidth: 1100,
    quality: 84
  },
  {
    source: "Featured Bullion Categories section — Branded Bullion.png",
    output: "branded-bullion.webp",
    maxWidth: 1100,
    quality: 84
  }
];

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

await fs.mkdir(outputRoot, { recursive: true });

const rows = [];

for (const asset of assets) {
  const sourcePath = path.join(sourceRoot, asset.source);
  const outputPath = path.join(outputRoot, asset.output);
  const inputStats = await fs.stat(sourcePath);
  const metadata = await sharp(sourcePath).metadata();
  const width = metadata.width && metadata.width > asset.maxWidth ? asset.maxWidth : metadata.width;

  await sharp(sourcePath)
    .resize({
      width,
      withoutEnlargement: true
    })
    .webp({
      quality: asset.quality,
      smartSubsample: true
    })
    .toFile(outputPath);

  const outputStats = await fs.stat(outputPath);
  rows.push({
    source: asset.source,
    output: `public/images/home/${asset.output}`,
    dimensions: `${metadata.width}x${metadata.height}`,
    maxWidth: asset.maxWidth,
    before: formatBytes(inputStats.size),
    after: formatBytes(outputStats.size)
  });
}

console.table(rows);
