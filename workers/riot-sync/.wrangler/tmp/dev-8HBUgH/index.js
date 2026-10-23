var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../src/shared/riot-sync.ts
var riotPlatforms = [
  "BR1",
  "NA1",
  "LA1",
  "LA2",
  "EUW1",
  "EUN1",
  "TR1",
  "RU",
  "KR",
  "JP1",
  "OC1",
  "PH2",
  "SG2",
  "TH2",
  "TW2",
  "VN2"
];
function isRiotPlatform(value) {
  return typeof value === "string" && riotPlatforms.includes(value);
}
__name(isRiotPlatform, "isRiotPlatform");

// src/index.ts
var RiotApiError = class extends Error {
  constructor(message, status, retryAfter = null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
  status;
  retryAfter;
  static {
    __name(this, "RiotApiError");
  }
};
var routeByPlatform = {
  BR1: { regionalHost: "americas", platformHost: "br1" },
  NA1: { regionalHost: "americas", platformHost: "na1" },
  LA1: { regionalHost: "americas", platformHost: "la1" },
  LA2: { regionalHost: "americas", platformHost: "la2" },
  EUW1: { regionalHost: "europe", platformHost: "euw1" },
  EUN1: { regionalHost: "europe", platformHost: "eun1" },
  TR1: { regionalHost: "europe", platformHost: "tr1" },
  RU: { regionalHost: "europe", platformHost: "ru" },
  KR: { regionalHost: "asia", platformHost: "kr" },
  JP1: { regionalHost: "asia", platformHost: "jp1" },
  OC1: { regionalHost: "sea", platformHost: "oc1" },
  PH2: { regionalHost: "sea", platformHost: "ph2" },
  SG2: { regionalHost: "sea", platformHost: "sg2" },
  TH2: { regionalHost: "sea", platformHost: "th2" },
  TW2: { regionalHost: "sea", platformHost: "tw2" },
  VN2: { regionalHost: "sea", platformHost: "vn2" }
};
var maximumBodyLength = 12e3;
var maximumMatchesPerSync = 20;
var maximumMatchStart = 1e5;
var successfulResponseCacheSeconds = 300;
var edgeCache = caches.default;
function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
__name(isRecord, "isRecord");
function parseSyncRequest(value) {
  if (!isRecord(value)) return null;
  const { gameName, tagLine, platform, start = 0 } = value;
  if (typeof gameName !== "string" || gameName.trim().length === 0 || gameName.length > 16 || gameName.includes("#") || typeof tagLine !== "string" || tagLine.trim().length === 0 || tagLine.length > 8 || tagLine.includes("#") || !isRiotPlatform(platform) || typeof start !== "number" || !Number.isInteger(start) || start < 0 || start > maximumMatchStart) {
    return null;
  }
  return {
    gameName: gameName.trim(),
    tagLine: tagLine.trim(),
    platform,
    start
  };
}
__name(parseSyncRequest, "parseSyncRequest");
async function fetchRiotJson(url, apiKey, api) {
  let response;
  try {
    response = await fetch(url, {
      headers: { "X-Riot-Token": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(1e4)
    });
  } catch (error) {
    throw new RiotApiError(
      error instanceof Error && error.name === "TimeoutError" ? "A API da Riot demorou para responder." : "N\xE3o foi poss\xEDvel conectar \xE0 API da Riot.",
      502
    );
  }
  if (!response.ok) {
    throw new RiotApiError(
      `A API ${api} da Riot recusou a solicita\xE7\xE3o (HTTP ${response.status}).`,
      response.status,
      response.headers.get("Retry-After")
    );
  }
  try {
    return await response.json();
  } catch (error) {
    throw new RiotApiError(
      error instanceof Error ? "A API da Riot retornou uma resposta inv\xE1lida." : "Resposta inv\xE1lida.",
      502
    );
  }
}
__name(fetchRiotJson, "fetchRiotJson");
async function getLeagueRank(routing, puuid, apiKey) {
  const url = `https://${routing.platformHost}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
  let entries;
  try {
    entries = await fetchRiotJson(url, apiKey, "League-V4");
  } catch (error) {
    if (error instanceof RiotApiError && error.status === 404) return null;
    throw error;
  }
  if (!Array.isArray(entries)) throw new RiotApiError("Resposta de elo inv\xE1lida da Riot.", 502);
  const soloQueue = entries.find(
    (entry) => isRecord(entry) && entry.queueType === "RANKED_SOLO_5x5"
  );
  if (!isRecord(soloQueue)) return null;
  const leaguePoints = typeof soloQueue.leaguePoints === "number" ? soloQueue.leaguePoints : 0;
  if (typeof soloQueue.tier !== "string" || typeof soloQueue.rank !== "string" || !Number.isInteger(leaguePoints)) {
    throw new RiotApiError("Dados de elo incompletos na resposta da Riot.", 502);
  }
  return {
    tier: soloQueue.tier,
    division: soloQueue.rank,
    leaguePoints
  };
}
__name(getLeagueRank, "getLeagueRank");
async function getRankedMatches(regionalHost, puuid, apiKey, start) {
  const idsUrl = `https://${regionalHost}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=420&start=${start}&count=${maximumMatchesPerSync}`;
  const ids = await fetchRiotJson(idsUrl, apiKey, "Match-V5");
  if (!Array.isArray(ids) || ids.length > maximumMatchesPerSync || ids.some((id) => typeof id !== "string" || id.length > 64)) {
    throw new RiotApiError("A lista de partidas retornada pela Riot \xE9 inv\xE1lida.", 502);
  }
  const newIds = ids;
  const matches = [];
  for (let index = 0; index < newIds.length; index += 5) {
    const batch = newIds.slice(index, index + 5);
    const batchMatches = await Promise.all(
      batch.map(async (matchId) => {
        const matchUrl = `https://${regionalHost}.api.riotgames.com/lol/match/v5/matches/` + encodeURIComponent(matchId);
        const match = await fetchRiotJson(matchUrl, apiKey, "Match-V5");
        const info = match.info;
        if (!info || match.metadata?.matchId !== matchId || info.queueId !== 420 || typeof info.gameStartTimestamp !== "number" || !Number.isFinite(info.gameStartTimestamp) || !Number.isFinite(new Date(info.gameStartTimestamp).getTime()) || typeof info.gameDuration !== "number" || info.gameDuration < 0 || info.gameDuration > 24 * 60 * 60 || !Array.isArray(info.participants)) {
          throw new RiotApiError("Os dados de uma partida retornada pela Riot s\xE3o inv\xE1lidos.", 502);
        }
        const participant = info.participants.find(
          (entry) => isRecord(entry) && entry.puuid === puuid && typeof entry.puuid === "string"
        );
        if (!participant || typeof participant.win !== "boolean" || typeof participant.championName !== "string" || !Number.isInteger(participant.kills) || participant.kills < 0 || !Number.isInteger(participant.deaths) || participant.deaths < 0 || !Number.isInteger(participant.assists) || participant.assists < 0 || !Number.isInteger(participant.totalMinionsKilled) || participant.totalMinionsKilled < 0 || !Number.isInteger(participant.neutralMinionsKilled) || participant.neutralMinionsKilled < 0 || !Number.isInteger(participant.goldEarned) || participant.goldEarned < 0 || !Number.isInteger(participant.totalDamageDealtToChampions) || participant.totalDamageDealtToChampions < 0) {
          throw new RiotApiError("Dados do jogador ausentes na partida retornada pela Riot.", 502);
        }
        return {
          matchId,
          startedAt: info.gameStartTimestamp,
          result: participant.win ? "win" : "loss",
          champion: participant.championName,
          durationSeconds: Math.max(0, Math.round(info.gameDuration)),
          stats: {
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
            cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
            goldEarned: participant.goldEarned,
            damageToChampions: participant.totalDamageDealtToChampions
          }
        };
      })
    );
    matches.push(...batchMatches);
  }
  return {
    matches,
    nextStart: newIds.length === maximumMatchesPerSync && start < maximumMatchStart ? Math.min(start + newIds.length, maximumMatchStart) : null
  };
}
__name(getRankedMatches, "getRankedMatches");
async function syncRankedMatches(request, environment) {
  const apiKey = environment.RIOT_API_KEY;
  if (!apiKey) throw new RiotApiError("O backend ainda n\xE3o configurou a chave Riot.", 503);
  const routing = routeByPlatform[request.platform];
  const accountUrl = `https://${routing.regionalHost}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(request.gameName)}/${encodeURIComponent(request.tagLine)}`;
  let account;
  try {
    account = await fetchRiotJson(accountUrl, apiKey, "Account-V1");
  } catch (error) {
    if (error instanceof RiotApiError && error.status === 404) {
      throw new RiotApiError("Riot ID n\xE3o encontrada nessa regi\xE3o.", 404);
    }
    throw error;
  }
  if (!isRecord(account) || typeof account.puuid !== "string" || !account.puuid) {
    throw new RiotApiError("A Riot ID n\xE3o foi encontrada ou a resposta da Riot \xE9 inv\xE1lida.", 404);
  }
  const [matchPage, rank] = await Promise.all([
    getRankedMatches(
      routing.regionalHost,
      account.puuid,
      apiKey,
      request.start ?? 0
    ),
    getLeagueRank(routing, account.puuid, apiKey)
  ]);
  return {
    matches: matchPage.matches,
    nextStart: matchPage.nextStart,
    rank,
    rankObservedAt: Date.now()
  };
}
__name(syncRankedMatches, "syncRankedMatches");
async function handleRequest(request, environment) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return jsonResponse({}, 204);
  if (url.pathname === "/health" && request.method === "GET") {
    return jsonResponse({ status: "ok" });
  }
  if (url.pathname !== "/api/v1/sync" || request.method !== "POST") {
    return jsonResponse({ error: "Endpoint n\xE3o encontrado." }, 404);
  }
  const address = request.headers.get("CF-Connecting-IP") ?? "local-development";
  const limit = await environment.SYNC_RATE_LIMIT.limit({ key: address });
  if (!limit.success) {
    return jsonResponse({ error: "Muitas sincroniza\xE7\xF5es. Tente novamente em um minuto." }, 429, {
      "Retry-After": "60"
    });
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > maximumBodyLength) {
    return jsonResponse({ error: "A solicita\xE7\xE3o excede o tamanho permitido." }, 413);
  }
  let body;
  try {
    const text = await request.text();
    if (text.length > maximumBodyLength) {
      return jsonResponse({ error: "A solicita\xE7\xE3o excede o tamanho permitido." }, 413);
    }
    body = JSON.parse(text);
  } catch {
    return jsonResponse({ error: "O corpo da solicita\xE7\xE3o deve ser JSON v\xE1lido." }, 400);
  }
  const syncRequest = parseSyncRequest(body);
  if (!syncRequest) {
    return jsonResponse({ error: "Riot ID ou regi\xE3o inv\xE1lida." }, 400);
  }
  if (!environment.RIOT_API_KEY) {
    return jsonResponse({ error: "O backend ainda n\xE3o configurou a chave Riot." }, 503);
  }
  try {
    const cacheKeyUrl = new URL("/_internal/cache/v1/sync", url.origin);
    cacheKeyUrl.searchParams.set("platform", syncRequest.platform);
    cacheKeyUrl.searchParams.set("gameName", syncRequest.gameName);
    cacheKeyUrl.searchParams.set("tagLine", syncRequest.tagLine);
    cacheKeyUrl.searchParams.set("start", String(syncRequest.start ?? 0));
    const cacheKey = new Request(cacheKeyUrl);
    const cached = await edgeCache.match(cacheKey);
    if (cached) return cached;
    const response = await syncRankedMatches(syncRequest, environment);
    const cacheableResponse = jsonResponse(response, 200, {
      "Cache-Control": `public, max-age=${successfulResponseCacheSeconds}`
    });
    await edgeCache.put(cacheKey, cacheableResponse.clone());
    return cacheableResponse;
  } catch (error) {
    if (!(error instanceof RiotApiError)) {
      console.error("Unexpected error while syncing Riot ranked matches.", error);
      return jsonResponse({ error: "Erro inesperado ao sincronizar partidas." }, 500);
    }
    const retryDelaySeconds = error.status === 429 && error.retryAfter && /^\d+$/.test(error.retryAfter) ? Number(error.retryAfter) : null;
    const message = error.status === 429 ? retryDelaySeconds !== null ? `A Riot limitou temporariamente as requisi\xE7\xF5es. Aguarde ${retryDelaySeconds} segundos e tente novamente.` : "A Riot limitou temporariamente as requisi\xE7\xF5es. Aguarde alguns minutos e tente novamente." : error.message;
    const status = error.status === 401 || error.status === 403 ? 503 : error.status === 404 ? 404 : error.status === 429 ? 429 : error.status >= 500 ? error.status : 502;
    const headers = {};
    if (error.retryAfter) headers["Retry-After"] = error.retryAfter;
    return jsonResponse({ error: message }, status, headers);
  }
}
__name(handleRequest, "handleRequest");
var src_default = {
  fetch(request, environment) {
    return handleRequest(request, environment);
  }
};

// ../../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Oih3IS/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Oih3IS/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
