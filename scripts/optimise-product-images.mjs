import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets/source/products");
const outputDir = path.join(root, "public/images/products");

const images = [
  ["iconic-bullion-20g.png", "iconic-bullion-20g.webp"],
  ["iconic-bullion-1oz.png", "iconic-bullion-1oz.webp"],
  ["iconic-bullion-50g.png", "iconic-bullion-50g.webp"],
  ["iconic-bullion-100g.png", "iconic-bullion-100g.webp"],
  ["iconic-bullion-250g.png", "iconic-bullion-250g.webp"],
  ["iconic-bullion-500g.png", "iconic-bullion-500g.webp"],
  ["iconic-bullion-1kg.png", "iconic-bullion-1kg.webp"],
  ["iconic-10g-back.png", "iconic-10g-back.webp"],
  ["iconic-10g-detail.png", "iconic-10g-detail.webp"],
  ["iconic-10g-packaging.png", "iconic-10g-packaging.webp"],
  ["iconic-10g-serial.png", "iconic-10g-serial.webp"],
  ["iconic-10g-certificate.png", "iconic-10g-certificate.webp"],
  ["iconic-10g-dimensions.png", "iconic-10g-dimensions.webp"]
];

await fs.mkdir(outputDir, { recursive: true });

const report = [];

for (const [sourceName, outputName] of images) {
  const source = path.join(sourceDir, sourceName);
  const output = path.join(outputDir, outputName);
  const before = await fs.stat(source);

  const image = sharp(source, { limitInputPixels: false });
  const metadata = await image.metadata();
  const maxDimension = sourceName.startsWith("iconic-bullion-") ? 1200 : 1448;

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
