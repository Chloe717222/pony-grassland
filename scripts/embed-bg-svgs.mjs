import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "content", "svg-global", "backgrounds");
const specs = [
  ["01", 768, 1376],
  ["02", 1390, 2471],
  ["03", 1627, 2170],
  ["04", 768, 1376],
];

for (const [id, w, h] of specs) {
  const jpg = path.join(dir, `bg-scene-${id}.jpg`);
  if (!fs.existsSync(jpg)) {
    throw new Error(`Missing jpg: ${jpg}`);
  }
  const b64 = fs.readFileSync(jpg).toString("base64");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
  <image href="data:image/jpeg;base64,${b64}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
</svg>
`;
  fs.writeFileSync(path.join(dir, `bg-scene-${id}.svg`), svg, "utf8");
}

console.log("Embedded 4 scene JPGs into SVG data URIs.");
