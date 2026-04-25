import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, "content", "data.json"), "utf8"));
const sceneCsv = {
  1: "scene1-gallery.csv",
  2: "scene2-gallery.csv",
  3: "scene3-gallery.csv",
  4: "scene4-gallery.csv",
  5: "scene5-gallery.csv",
};

function sidFromScene(sc) {
  const s = String(sc || "").trim();
  if (/^\d{4}$/.test(s)) {
    const d = Number(s[0]);
    if (d >= 1 && d <= 5) return d;
  }
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 5) return n;
  return 1;
}

const lineMap = new Map();
for (const sid of [1, 2, 3, 4, 5]) {
  const rel = sceneCsv[sid];
  const abs = path.join(root, "content", rel);
  if (!fs.existsSync(abs)) continue;
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] || "";
    if (!line.trim()) continue;
    const m = /^\s*(\d+)\s*,/.exec(line);
    if (!m) continue;
    lineMap.set(m[1], { sid, rel, line: i + 1 });
  }
}

const miss = [];
for (const it of data.gallery || []) {
  const uid = it.userId == null ? "" : String(it.userId).trim();
  if (uid) continue;
  const id = String(it.id);
  const sid = sidFromScene(it.scene);
  const loc = lineMap.get(id) || { sid, rel: sceneCsv[sid], line: null };
  miss.push({
    id,
    sid,
    scene: it.scene,
    rel: loc.rel,
    line: loc.line,
    type: it.type || "",
    text: (it.text || "").replace(/\s+/g, " ").slice(0, 40),
  });
}

miss.sort((a, b) => a.sid - b.sid || Number(a.id) - Number(b.id));
const by = { 1: [], 2: [], 3: [], 4: [], 5: [] };
for (const m of miss) by[m.sid].push(m);

const out = [];
out.push("MISSING_USERID_TOTAL=" + miss.length);
for (const sid of [1, 2, 3, 4, 5]) {
  out.push("");
  out.push("[SCENE " + sid + "] count=" + by[sid].length);
  for (const m of by[sid]) {
    out.push(
      m.id +
        "\t" +
        m.rel +
        ":" +
        (m.line == null ? "?" : m.line) +
        "\ttype=" +
        m.type +
        "\tscene=" +
        m.scene +
        "\ttext=" +
        m.text
    );
  }
}

const outPath = path.join(root, "tmp-missing-userid.txt");
fs.writeFileSync(outPath, out.join("\n"), "utf8");
console.log("written", outPath, "with", miss.length, "items");
