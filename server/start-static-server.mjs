import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 8000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function safeDecode(uriPart) {
  try {
    return decodeURIComponent(uriPart);
  } catch {
    return uriPart;
  }
}

function resolveRequestPath(urlPathname) {
  const rawPath = safeDecode(urlPathname.split("?")[0] || "/");
  const normalized = path.normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const relativePath = normalized.replace(/^[/\\]+/, "");
  let filePath = path.join(rootDir, relativePath);

  if (rawPath === "/" || rawPath === "") {
    filePath = path.join(rootDir, "index.html");
  }

  return filePath;
}

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const method = req.method || "GET";
  if (method !== "GET" && method !== "HEAD") {
    send(res, 405, "Method Not Allowed", "text/plain; charset=utf-8");
    return;
  }

  const targetPath = resolveRequestPath(req.url || "/");
  const normalizedRoot = path.normalize(rootDir + path.sep);
  const normalizedTarget = path.normalize(targetPath);

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.stat(normalizedTarget, (statErr, stats) => {
    let finalPath = normalizedTarget;
    if (!statErr && stats.isDirectory()) {
      finalPath = path.join(normalizedTarget, "index.html");
    }

    fs.readFile(finalPath, (readErr, data) => {
      if (readErr) {
        send(res, 404, "Not Found", "text/plain; charset=utf-8");
        return;
      }

      const ext = path.extname(finalPath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      });
      if (method === "HEAD") {
        res.end();
        return;
      }
      res.end(data);
    });
  });
});

server.listen(port, host, () => {
  console.log(`Static server running at http://${host}:${port}/index.html`);
  console.log(`Serving files from ${rootDir}`);
});

server.on("error", (err) => {
  console.error("Failed to start static server:", err.message);
  process.exit(1);
});
