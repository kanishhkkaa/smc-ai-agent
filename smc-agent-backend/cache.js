/**
 * cache.js — SMC Insurance Caching Layer
 * ─────────────────────────────────────────────────
 * Replaces CubeDev without Docker.
 * Uses node-cache (in-memory, zero setup).
 *
 * TTL strategy:
 *   summary      → 10 min  (rarely changes mid-day)
 *   by_date      → 15 min  (past dates never change)
 *   by_agent     →  8 min
 *   by_company   →  8 min
 *   recent_calls →  2 min  (most live-feeling)
 *   glm_intent   → 30 min  (same message = same intent)
 *   kpis         →  5 min
 */

const NodeCache = require('node-cache');

// Main data cache — results from queryData()
const dataCache = new NodeCache({
  stdTTL: 600,        // 10 min default
  checkperiod: 120,   // sweep expired keys every 2 min
  useClones: false    // skip deep-copy for speed
});

// Intent cache — GLM intent detection results
// Same user message → same intent, no need to call GLM again
const intentCache = new NodeCache({
  stdTTL: 1800,       // 30 min — intents are stable
  checkperiod: 300,
  useClones: false
});

// TTL per intent type (seconds)
const TTL = {
  get_summary:        600,   // 10 min
  get_calls_by_date:  900,   // 15 min (past dates won't change)
  get_calls_by_agent: 480,   // 8 min
  get_calls_by_company: 480, // 8 min
  get_recent_calls:   120,   // 2 min (keep feeling live)
  general_question:   0,     // don't cache general Q&A
  kpis:               300,   // 5 min
};

/**
 * Build a consistent cache key from intent + params
 * e.g. "get_calls_by_date:2026-06-24"
 */
function makeKey(intent, params = {}) {
  const paramStr = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))  // sort for consistency
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return paramStr ? `${intent}:${paramStr}` : intent;
}

/**
 * Get a data result from cache.
 * Returns undefined if not found or expired.
 */
function getDataCache(intent, params) {
  const key = makeKey(intent, params);
  const hit = dataCache.get(key);
  if (hit !== undefined) {
    console.log(`[CACHE HIT]  ${key}`);
    return hit;
  }
  console.log(`[CACHE MISS] ${key}`);
  return undefined;
}

/**
 * Save a data result to cache.
 */
function setDataCache(intent, params, value) {
  const ttl = TTL[intent] || 300;
  if (ttl === 0) return; // don't cache general questions
  const key = makeKey(intent, params);
  dataCache.set(key, value, ttl);
  console.log(`[CACHE SET]  ${key} (TTL: ${ttl}s)`);
}

/**
 * Get GLM intent from cache (keyed by exact message text).
 */
function getIntentCache(message) {
  const key = `intent:${message.trim().toLowerCase()}`;
  const hit = intentCache.get(key);
  if (hit !== undefined) {
    console.log(`[INTENT HIT] "${message.substring(0, 40)}..."`);
    return hit;
  }
  return undefined;
}

/**
 * Save GLM intent result to cache.
 */
function setIntentCache(message, intentObj) {
  const key = `intent:${message.trim().toLowerCase()}`;
  intentCache.set(key, intentObj);
}

/**
 * Cache stats — call GET /api/cache/stats to see this
 */
function getStats() {
  const ds = dataCache.getStats();
  const is = intentCache.getStats();
  return {
    data_cache: {
      keys:   dataCache.keys().length,
      hits:   ds.hits,
      misses: ds.misses,
      hit_rate: ds.hits + ds.misses > 0
        ? `${((ds.hits / (ds.hits + ds.misses)) * 100).toFixed(1)}%`
        : '0%'
    },
    intent_cache: {
      keys:   intentCache.keys().length,
      hits:   is.hits,
      misses: is.misses,
      hit_rate: is.hits + is.misses > 0
        ? `${((is.hits / (is.hits + is.misses)) * 100).toFixed(1)}%`
        : '0%'
    }
  };
}

/**
 * Flush all caches (call when new data is loaded)
 */
function flushAll() {
  dataCache.flushAll();
  intentCache.flushAll();
  console.log('[CACHE] All caches flushed ✅');
}

module.exports = {
  getDataCache,
  setDataCache,
  getIntentCache,
  setIntentCache,
  getStats,
  flushAll,
  TTL
};
