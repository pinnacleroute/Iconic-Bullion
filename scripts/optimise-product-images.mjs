import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const images = [
  ["products", "iconic-bullion-20g.png", "products", "iconic-bullion-20g.webp", 1200],
  ["products", "iconic-bullion-1oz.png", "products", "iconic-bullion-1oz.webp", 1200],
  ["products", "iconic-bullion-50g.png", "products", "iconic-bullion-50g.webp", 1200],
  ["products", "iconic-bullion-100g.png", "products", "iconic-bullion-100g.webp", 1200],
  ["products", "iconic-bullion-250g.png", "products", "iconic-bullion-250g.webp", 1200],
  ["products", "iconic-bullion-500g.png", "products", "iconic-bullion-500g.webp", 1200],
  ["products", "iconic-bullion-1kg.png", "products", "iconic-bullion-1kg.webp", 1200],
  ["products", "iconic-10g-back.png", "products", "iconic-10g-back.webp", 1448],
  ["products", "iconic-10g-detail.png", "products", "iconic-10g-detail.webp", 1448],
  ["products", "iconic-10g-packaging.png", "products", "iconic-10g-packaging.webp", 1448],
  ["products", "iconic-10g-serial.png", "products", "iconic-10g-serial.webp", 1448],
  ["products", "iconic-10g-certificate.png", "products", "iconic-10g-certificate.webp", 1448],
  ["products", "iconic-10g-dimensions.png", "products", "iconic-10g-dimensions.webp", 1448],
  ["market", "live-gold-hero.png", "market", "live-gold-hero.webp", 2000],
  ["market", "market-trust.png", "market", "market-trust.webp", 1448]
];

const report = [];

for (const [sourceFolder, sourceName, outputFolder, outputName, maxDimension] of images) {
  const source = path.join(root, "assets/source", sourceFolder, sourceName);
  const outputDir = path.join(root, "public/images", outputFolder);
  const output = path.join(outputDir, outputName);
  const before = await fs.stat(source);

  await fs.mkdir(outputDir, { recursive: true });

  const image = sharp(source, { limitInputPixels: false });
  const metadata = await image.metadata();

  await image
    .resize({
      width: Math.min(metadata.width ?? maxDimension, maxDimension),
      height: Math.min(metadata.height ?? maxDimension, maxDimension),
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: 84, effort: 6 })
    .toFile(output);

  const after = await fs.stat(output);
  const optimised = await sharp(output).metadata();

  report.push({
    source: path.relative(root, source),
    output: path.relative(root, output),
    sourceKb: Math.round(before.size / 1024),
    outputKb: Math.round(after.size / 1024),
    dimensions: `${optimised.width}x${optimised.height}`
  });
}

console.table(report);
