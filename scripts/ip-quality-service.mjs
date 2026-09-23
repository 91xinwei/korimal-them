#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const port = Number(process.env.IP_QUALITY_PORT || 8787);
const targetsFile = resolve(process.env.IP_QUALITY_TARGETS_FILE || "./ip-quality-targets.json");
const cacheFile = resolve(process.env.IP_QUALITY_CACHE_FILE || "./data/ip-quality-cache.json");
const refreshMs = Math.max(60_000, Number(process.env.IP_QUALITY_REFRESH_MS || 86_400_000));
let cache = { nodes: [], generatedAt: null, nextRefreshAt: null, errors: [] };
let refreshPromise;

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function inspectTarget(target) {
  const quality = { checkedAt: new Date().toISOString() };
  const errors = [];
  if (process.env.IPQS_API_KEY) {
    try {
      quality.ipqs = await jsonFetch(
        `https://www.ipqualityscore.com/api/json/ip/${encodeURIComponent(process.env.IPQS_API_KEY)}/${encodeURIComponent(target.ip)}?strictness=1&allow_public_access_points=true&lighter_penalties=true`,
      );
    } catch (error) { errors.push(`ipqs: ${error.message}`); }
  }
  if (process.env.IPINFO_TOKEN) {
    try {
      quality.ipinfo = await jsonFetch(
        `https://ipinfo.io/${encodeURIComponent(target.ip)}/json?token=${encodeURIComponent(process.env.IPINFO_TOKEN)}`,
      );
    } catch (error) { errors.push(`ipinfo: ${error.message}`); }
  }
  if (process.env.ABUSEIPDB_API_KEY) {
    try {
      quality.abuseipdb = await jsonFetch(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(target.ip)}&maxAgeInDays=90`,
        { headers: { Accept: "application/json", Key: process.env.ABUSEIPDB_API_KEY } },
      );
    } catch (error) { errors.push(`abuseipdb: ${error.message}`); }
  }
  if (!quality.ipqs && !quality.ipinfo && !quality.abuseipdb) {
    throw new Error("No provider succeeded; configure at least one provider API key");
  }
  return { id: target.id, quality, errors };
}

async function loadTargets() {
  const parsed = JSON.parse(await readFile(targetsFile, "utf8"));
  const values = Array.isArray(parsed) ? parsed : parsed.nodes;
  if (!Array.isArray(values)) throw new Error("Targets must be an array or { nodes: [] }");
  return values.filter((target) => target && String(target.id || "").trim() && String(target.ip || "").trim());
}

async function persist(value) {
  await mkdir(dirname(cacheFile), { recursive: true });
  const temporary = `${cacheFile}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, cacheFile);
}

async function refresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const targets = await loadTargets();
    const settled = await Promise.allSettled(targets.map(inspectTarget));
    const nodes = [];
    const errors = [];
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        nodes.push({ id: result.value.id, quality: result.value.quality });
        errors.push(...result.value.errors.map((message) => ({ id: result.value.id, message })));
      } else {
        errors.push({ id: targets[index].id, message: result.reason?.message || String(result.reason) });
      }
    });
    if (nodes.length === 0 && cache.nodes.length) return cache;
    const generatedAt = new Date().toISOString();
    cache = { nodes, generatedAt, nextRefreshAt: new Date(Date.now() + refreshMs).toISOString(), errors };
    await persist(cache);
    return cache;
  })().finally(() => { refreshPromise = undefined; });
  return refreshPromise;
}

try { cache = JSON.parse(await readFile(cacheFile, "utf8")); } catch { /* first run */ }
void refresh().catch((error) => console.error("Initial IP quality refresh failed:", error.message));
setInterval(() => void refresh().catch((error) => console.error("Scheduled refresh failed:", error.message)), refreshMs).unref();

createServer(async (request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, generatedAt: cache.generatedAt, nextRefreshAt: cache.nextRefreshAt }));
    return;
  }
  if (request.url !== "/api/ip-quality") {
    response.writeHead(404).end();
    return;
  }
  if (!cache.generatedAt || Date.now() - Date.parse(cache.generatedAt) >= refreshMs) {
    await refresh().catch(() => undefined);
  }
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
  });
  response.end(JSON.stringify(cache));
}).listen(port, "127.0.0.1", () => {
  console.log(`IP quality service listening on http://127.0.0.1:${port}/api/ip-quality`);
});
