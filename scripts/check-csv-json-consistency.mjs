import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, "content", "data.json"), "utf8"));

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  let atFieldStart = true;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (c === '"') {
      if (inQ) {
        if (i + 1 < line.length && line.charAt(i + 1) === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else if (atFieldStart) {
        inQ = true;
      } else {
        cur += c;
      }
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
      atFieldStart = true;
    } else {
      cur += c;
      atFieldStart = false;
    }
  }
  out.push(cur);
  return out;
}

function splitCsvRecords(text) {
  const rawLines = String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((ln) => ln.replace(/\s/g, "").length);
  if (!rawLines.length) return [];
  const out = [rawLines[0]];
  for (let i = 1; i < rawLines.length; i++) {
    const ln = rawLines[i];
    if (/^\s*\d+\s*,/.test(ln)) out.push(ln);
    else out[out.length - 1] += "\n" + ln;
  }
  return out;
}

function norm(v) {
  return String(v == null ? "" : v).trim();
}

function getSceneIdBySceneCell(cell) {
  const sc = norm(cell);
  if (/^\d{4}$/.test(sc)) return Number(sc[0]);
  const n = parseInt(sc, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 5) return n;
  return 1;
}

const report = [];
for (let sid = 1; sid <= 5; sid++) {
  const csvPath = path.join(root, "content", `scene${sid}-gallery.csv`);
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = splitCsvRecords(text);
  const header = parseCSVLine(lines[0]).map((h) => norm(h).replace(/^\uFEFF/, "").replace(/\s+/g, ""));

  const idx = (name) => header.findIndex((h) => h === name);
  const idxLower = (name) => header.findIndex((h) => h.toLowerCase() === name);

  const iId = idx("编号") >= 0 ? idx("编号") : 0;
  const iScene = idx("场景");
  const iCopy = idx("文案") >= 0 ? idx("文案") : 1;
  const iImg = idxLower("图片url");
  const iAud = idxLower("音频url");
  const iVid = idxLower("视频url");
  const iUid = header.findIndex((h) => h === "用户id" || h.toLowerCase() === "userid");

  const csvRows = [];
  for (let r = 1; r < lines.length; r++) {
    const parts = parseCSVLine(lines[r]);
    const id = parseInt(norm(parts[iId]), 10);
    if (Number.isNaN(id)) continue;
    const row = {
      id,
      scene: iScene >= 0 ? norm(parts[iScene]) : String(sid),
      text: iCopy >= 0 ? norm(parts[iCopy]) : "",
      image: iImg >= 0 ? norm(parts[iImg]) : "",
      audio: iAud >= 0 ? norm(parts[iAud]) : "",
      video: iVid >= 0 ? norm(parts[iVid]) : "",
      userId: iUid >= 0 ? norm(parts[iUid]) : "",
    };
    if (row.userId && !row.text && !row.image && !row.audio && !row.video) continue;
    csvRows.push(row);
  }

  const jsonRows = (data.gallery || []).filter((x) => getSceneIdBySceneCell(x.scene) === sid);
  const csvById = new Map(csvRows.map((r) => [r.id, r]));
  const jsonById = new Map(jsonRows.map((r) => [Number(r.id), r]));

  const onlyCsv = [...csvById.keys()].filter((id) => !jsonById.has(id));
  const onlyJson = [...jsonById.keys()].filter((id) => !csvById.has(id));

  const mismatches = [];
  const fields = ["scene", "text", "image", "audio", "video", "userId"];
  for (const [id, c] of csvById) {
    const j = jsonById.get(id);
    if (!j) continue;
    for (const f of fields) {
      if (norm(c[f]) !== norm(j[f])) {
        mismatches.push(id);
        break;
      }
    }
  }

  report.push({
    scene: sid,
    csvCount: csvRows.length,
    jsonCount: jsonRows.length,
    onlyInCsv: onlyCsv.length,
    onlyInJson: onlyJson.length,
    fieldMismatchCount: mismatches.length,
    sampleOnlyInCsv: onlyCsv.slice(0, 5),
    sampleOnlyInJson: onlyJson.slice(0, 5),
    sampleMismatchIds: mismatches.slice(0, 5),
  });
}

console.log(JSON.stringify(report, null, 2));
