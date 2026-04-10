/**
 * 腾讯云 CVM 上接收「答题记录」的最小服务（仅需本机已装 Node.js 18+）
 *
 * 1) 上传整个站点静态文件到 /var/www/lianlian/（或任意目录）
 * 2) 本文件放在 server/ 下，与 quiz-logs.jsonl 同目录生成日志
 * 3) 运行：node receive-quiz.mjs
 *    或：PORT=3840 node receive-quiz.mjs
 * 4) 安全组/防火墙放行端口（如 3840）；HTTPS 建议前面加 Nginx 反代
 * 5) 运营后台「答题记录接收地址」填：https://你的域名或IP:端口/quiz-log
 *
 * 日志：同目录追加写入 quiz-logs.jsonl（一行一条 JSON）
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, "quiz-logs.jsonl");
const PORT = Number(process.env.PORT) || 3840;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(),
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    json(res, 200, { ok: true, service: "quiz-log-receiver" });
    return;
  }

  if (req.method === "POST" && req.url === "/quiz-log") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      JSON.parse(raw);
    } catch {
      json(res, 400, { ok: false, error: "invalid_json" });
      return;
    }
    await fs.promises.appendFile(LOG_FILE, raw + "\n", "utf8");
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { ok: false, error: "not_found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[receive-quiz] listening http://0.0.0.0:${PORT}  POST /quiz-log`);
});
