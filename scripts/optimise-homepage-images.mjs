import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const projectRoot = process.cwd();
const sourceRoot = "/Users/amankumarsingh/Downloads/Iconic Bullion Images/Homepage";
const outputRoot = path.join(projectRoot, "public/images/home");
const productOutputRoot = path.join(projectRoot, "public/images/products");

const assets = [
  {
    source: "/tmp/iconic-figma-home/src/imports/Brand_Logo.png",
    output: "brand-logo.webp",
    maxWidth: 520,
    quality: 88,
    extract: { left: 150, top: 250, width: 1150, height: 500 }
  },
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
  },
  {
    source: "Available Bullion Sizes : Gold Bar Range.png",
    output: "bar-sizes.webp",
    maxWidth: 1500,
    quality: 84
  }
];

const productAssets = [
  {
    source: "Iconic Bullion 1g Minted Gold Bar.png",
    output: "iconic-1g.webp",
    maxWidth: 1000,
    quality: 84
  },
  {
    source: "Iconic Bullion 5g Minted Gold Bar.png",
    output: "iconic-5g.webp",
    maxWidth: 1000,
    quality: 84
  },
  {
    source: "Iconic Bullion 10g Minted Gold Bar.png",
    output: "iconic-10g.webp",
    maxWidth: 1000,
    quality: 84
  },
  {
    source: "Premium 1g Third-Party Branded Gold Bar.png",
    output: "premium-1g.webp",
    maxWidth: 1000,
    quality: 84
  }
];

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

await fs.mkdir(outputRoot, { recursive: true });
await fs.mkdir(productOutputRoot, { recursive: true });

const rows = [];

async function optimise(asset, destinationRoot, publicPrefix) {
  const sourcePath = path.isAbsolute(asset.source) ? asset.source : path.join(sourceRoot, asset.source);
  const outputPath = path.join(outputRoot, asset.output);
  const destinationPath = path.join(destinationRoot, asset.output);
  const inputStats = await fs.stat(sourcePath);
  const metadata = await sharp(sourcePath).metadata();

  let pipeline = sharp(sourcePath);
  if (asset.extract) {
    pipeline = pipeline.extract(asset.extract);
  }
  const outputMetadata = asset.extract ? await pipeline.clone().metadata() : metadata;
  const width = outputMetadata.width && outputMetadata.width > asset.maxWidth ? asset.maxWidth : outputMetadata.width;

  await pipeline
    .resize({
      width,
      withoutEnlargement: true
    })
    .webp({
      quality: asset.quality,
      smartSubsample: true
    })
    .toFile(destinationPath);

  const outputStats = await fs.stat(destinationPath);
  rows.push({
    source: asset.source,
    output: `${publicPrefix}/${asset.output}`,
    dimensions: `${metadata.width}x${metadata.height}${asset.extract ? ` -> ${outputMetadata.width}x${outputMetadata.height}` : ""}`,
    maxWidth: asset.maxWidth,
    before: formatBytes(inputStats.size),
    after: formatBytes(outputStats.size)
  });
}

for (const asset of assets) {
  await optimise(asset, outputRoot, "public/images/home");
}

for (const asset of productAssets) {
  await optimise(asset, productOutputRoot, "public/images/products");
}

console.table(rows);
