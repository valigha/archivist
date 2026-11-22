// Archivist gateway: runs the Folio and Nexus apps side by side in one container
// and serves one page with a tab for each, plus a shared library box.
import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const VERSION = readFileSync(join(ROOT, "VERSION"), "utf8").trim();
const PORT = Number(process.env.PORT) || 8090;
const CONFIG_ROOT = process.env.CONFIG_DIR || "/app/config";
const LOG_ROOT = process.env.LOG_ROOT || "/app/log";
const LIBRARY = process.env.LIBRARY_PATH || "/app/library/";

const APPS = {
  folio: { name: "Folio", prefix: "FOLIO_", port: 18099 },
  nexus: { name: "Nexus", prefix: "NEXUS_", port: 18100 },
};

const t = () => new Date().toISOString();
const say = (msg) => console.log(`[${t()}] INFO  [archivist] ${msg}`);

// ---------- supervisor ----------

// Each app gets the shared environment, then its own FOLIO_* / NEXUS_* values
// on top (FOLIO_REQUEST_DELAY_MS becomes REQUEST_DELAY_MS for Folio only).
function envFor(key) {
  const app = APPS[key];
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (Object.values(APPS).some((a) => k.startsWith(a.prefix))) continue;
    env[k] = v;
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith(app.prefix)) env[k.slice(app.prefix.length)] = v;
  }
  const cfgDir = join(CONFIG_ROOT, key);
  const logDir = join(LOG_ROOT, key);
  mkdirSync(cfgDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
  env.LIBRARY_PATH = LIBRARY;
  env.DOWNLOADME_FILEPATH ??= join(cfgDir, "downloadme.txt");
  env.DONTDOWNLOADME_FILEPATH ??= join(cfgDir, "dontdownloadme.txt");
  env.ENV_FILE ??= join(cfgDir, ".env");
  env.LOG_DIR = logDir;
  env.STATUS_PORT = String(app.port);
  return env;
}

let shuttingDown = false;
const running = {};

function start(key) {
  const app = APPS[key];
  let child;
  try {
    child = spawn(process.execPath, [join(ROOT, "apps", key, "worker.mjs")], {
      env: envFor(key),
      cwd: join(ROOT, "apps", key),
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    console.log(`[${t()}] ERROR [archivist] could not start ${app.name}: ${err.message}`);
    return;
  }
  running[key] = child;
  const pipe = (stream) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (line) console.log(`[${key}] ${line}`);
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code, sig) => {
    running[key] = null;
    if (shuttingDown) return;
    console.log(`[${t()}] WARN  [archivist] ${app.name} stopped (${sig || "code " + code}) — restarting in 5s`);
    setTimeout(() => start(key), 5000).unref();
  });
}

function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  say("Shutting down");
  for (const c of Object.values(running)) c?.kill("SIGTERM");
  setTimeout(() => process.exit(0), 8000).unref();
  const poll = setInterval(() => {
    if (Object.values(running).every((c) => !c)) process.exit(0);
  }, 200);
  poll.unref?.();
}
process.on("SIGTERM", stopAll);
process.on("SIGINT", stopAll);

// ---------- helpers to talk to the apps ----------

function callApp(key, path, { method = "GET", timeout = 3000 } = {}) {
  return new Promise((resolve) => {
    const req = httpRequest(
      { host: "127.0.0.1", port: APPS[key].port, path, method, timeout, headers: method === "POST" ? { "content-type": "application/json", "content-length": 2 } : {} },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          try { resolve({ ok: res.statusCode < 400, json: JSON.parse(body) }); } catch { resolve({ ok: false, json: null }); }
        });
      },
    );
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, json: null }); });
    req.on("error", () => resolve({ ok: false, json: null }));
    if (method === "POST") req.write("{}");
    req.end();
  });
}

async function librarySummary() {
  const [f, n] = await Promise.all([callApp("folio", "/api/status"), callApp("nexus", "/api/status")]);
  const fs = f.json || {};
  const ns = n.json || {};
  const total = Math.max(fs.libraryTotal || 0, ns.libraryTotal || 0);
  const folio = fs.libraryCount || 0;
  const nexus = ns.libraryCount || 0;
  const times = [fs.libraryScannedAt, ns.libraryScannedAt].filter(Boolean).sort();
  return {
    version: VERSION,
    total,
    folio,
    nexus,
    other: Math.max(0, total - folio - nexus),
    scanning: Boolean(fs.libraryScanning || ns.libraryScanning),
    scannedAt: times[0] || null,
    apps: {
      folio: { up: f.ok, version: fs.version || "", state: fs.state || "", paused: Boolean(fs.paused) },
      nexus: { up: n.ok, version: ns.version || "", state: ns.state || "", loggedIn: ns.loggedIn ?? null },
    },
  };
}

// ---------- web server ----------

const SHELL = readFileSync(join(HERE, "shell.html"), "utf8").replaceAll("__VERSION__", VERSION);

function shim(base) {
  // The two dashboards call fetch("/api/..."); point those at this app's own prefix.
  return `<script>(function(){var B=${JSON.stringify(base)},f=window.fetch;window.fetch=function(u,o){if(typeof u==="string"&&u.charAt(0)==="/"&&u.indexOf(B+"/")!==0)u=B+u;return f.call(this,u,o)}})();</script>`;
}

function proxy(key, req, res, rest) {
  const base = "/" + key;
  const up = httpRequest(
    { host: "127.0.0.1", port: APPS[key].port, path: rest, method: req.method, headers: { ...req.headers, host: "127.0.0.1" } },
    (r) => {
      const type = String(r.headers["content-type"] || "");
      if (!type.includes("text/html")) {
        res.writeHead(r.statusCode || 502, r.headers);
        r.pipe(res);
        return;
      }
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => {
        let html = Buffer.concat(chunks).toString("utf8");
        html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + shim(base)) : shim(base) + html;
        const headers = { ...r.headers, "content-length": Buffer.byteLength(html) };
        delete headers["content-encoding"];
        res.writeHead(r.statusCode || 200, headers);
        res.end(html);
      });
    },
  );
  up.on("error", () => {
    res.writeHead(502, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><meta charset="utf-8"><body style="font:15px system-ui;background:#0b0c0e;color:#ece8e1;padding:32px"><h3>${APPS[key].name} is starting…</h3><p>This page retries on its own. If it stays like this, check the container log for lines starting with [${key}].</p><script>setTimeout(()=>location.reload(),3000)</script>`);
  });
  req.pipe(up);
}

function json(res, code, body) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const path = url.pathname;
  if (path === "/health") {
    const s = await librarySummary();
    json(res, s.apps.folio.up && s.apps.nexus.up ? 200 : 503, { ok: s.apps.folio.up && s.apps.nexus.up, apps: s.apps });
    return;
  }
  if (path === "/api/library" && req.method === "GET") {
    json(res, 200, await librarySummary());
    return;
  }
  if (path === "/api/rescan" && req.method === "POST") {
    await Promise.all([callApp("folio", "/api/rescan", { method: "POST" }), callApp("nexus", "/api/rescan", { method: "POST" })]);
    json(res, 200, await librarySummary());
    return;
  }
  for (const key of Object.keys(APPS)) {
    if (path === "/" + key) {
      res.writeHead(302, { location: `/${key}/` });
      res.end();
      return;
    }
    if (path.startsWith("/" + key + "/")) {
      proxy(key, req, res, path.slice(key.length + 1) + url.search);
      return;
    }
  }
  if (path === "/" || path === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(SHELL);
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}).listen(PORT, "0.0.0.0", () => say(`Archivist ${VERSION} on port ${PORT} — Folio on :${APPS.folio.port}, Nexus on :${APPS.nexus.port} (internal)`));

for (const key of Object.keys(APPS)) start(key);
