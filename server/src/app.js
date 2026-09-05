const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const { JsonStore } = require("./data/store");
const { AppError, NotFoundError, ValidationError } = require("./errors");
const { logger } = require("./logger");
const { seedNeighborhood } = require("./neighborhood/seed");
const service = require("./neighborhood/service");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function sendJson(res, status, payload, requestId) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-request-id": requestId,
  });
  res.end(JSON.stringify(payload));
}

function applyBaseHeaders(req, res, config, requestId) {
  const origin = req.headers.origin;
  const allowedOrigin = origin && origin === config.corsOrigin ? origin : config.corsOrigin;
  res.setHeader("access-control-allow-origin", allowedOrigin);
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,PUT,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,x-request-id");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "SAMEORIGIN");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("x-request-id", requestId);
}

async function parseBody(req) {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return {};
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new ValidationError([{ field: "body", message: "请求体不能超过 1MB" }]);
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError([{ field: "body", message: "JSON 格式不正确" }]);
  }
}

function readCollection(store, key) {
  return store.read()[key];
}

async function routeApi(method, pathname, body, store, env = process.env) {
  if (method === "GET" && pathname === "/health") return { status: 200, body: { status: "ok" } };
  if (method === "GET" && pathname === "/ready") {
    const ready = store.check();
    return { status: ready ? 200 : 503, body: { status: ready ? "ok" : "degraded", checks: { store: ready ? "ok" : "failed" } } };
  }
  if (method === "GET" && pathname === "/api/profile") return { status: 200, body: { profile: readCollection(store, "profile") } };
  if (method === "GET" && pathname === "/api/users") return { status: 200, body: { users: readCollection(store, "users") } };
  if (method === "GET" && pathname === "/api/tools") return { status: 200, body: { tools: readCollection(store, "tools") } };
  if (method === "GET" && pathname === "/api/orders") return { status: 200, body: { orders: readCollection(store, "orders") } };
  if (method === "GET" && pathname === "/api/community/feed") return { status: 200, body: { posts: readCollection(store, "feed") } };
  if (method === "GET" && pathname === "/api/risk/policy") return { status: 200, body: service.getRiskPolicy() };
  if (method === "POST" && pathname === "/api/assistant/chat") return { status: 200, body: await service.assistantChat(store, body, env) };
  if (method === "POST" && pathname === "/api/tasks/parse") return { status: 200, body: service.parseAndMatch(store, body.text) };
  if (method === "POST" && pathname === "/api/orders") return { status: 201, body: { order: service.createOrder(store, body) } };

  const creditAction = pathname.match(/^\/api\/users\/([^/]+)\/credit-events$/);
  if (creditAction && method === "POST") {
    return { status: 200, body: service.applyCreditEvent(store, creditAction[1], body) };
  }

  const orderAction = pathname.match(/^\/api\/orders\/([^/]+)\/(advance|evidence|dispute|chain)$/);
  if (orderAction && method === "PATCH") {
    const [, id, action] = orderAction;
    if (action === "advance") return { status: 200, body: { order: service.advanceOrder(store, id) } };
    if (action === "evidence") return { status: 200, body: { order: service.addEvidence(store, id, body.note) } };
    if (action === "dispute") return { status: 200, body: { order: service.disputeOrder(store, id, body.reason) } };
    if (action === "chain") return { status: 200, body: { order: service.attachChainMetadata(store, id, body) } };
  }

  const borrowAction = pathname.match(/^\/api\/tools\/([^/]+)\/borrow$/);
  if (borrowAction && method === "POST") {
    return { status: 201, body: { order: service.borrowTool(store, borrowAction[1], body.borrowerId) } };
  }

  if (pathname.startsWith("/api/")) throw new NotFoundError("接口", pathname);
  return null;
}

function serveStatic(req, res, config, requestId) {
  const url = new URL(req.url, "http://localhost");
  const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const absolutePath = path.resolve(config.staticRoot, `.${requested}`);
  const root = path.resolve(config.staticRoot);
  if (!absolutePath.startsWith(root)) throw new NotFoundError("文件", requested);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) throw new NotFoundError("文件", requested);

  const ext = path.extname(absolutePath).toLowerCase();
  res.writeHead(200, {
    "content-type": mimeTypes[ext] || "application/octet-stream",
    "x-request-id": requestId,
  });
  fs.createReadStream(absolutePath).pipe(res);
}

function handleError(error, res, requestId) {
  if (error instanceof AppError && error.isOperational) {
    sendJson(
      res,
      error.status,
      {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
      },
      requestId
    );
    return;
  }

  logger.error("unexpected_error", { requestId, message: error.message, stack: error.stack });
  sendJson(res, 500, { code: "INTERNAL_ERROR", message: "服务器暂时不可用", requestId }, requestId);
}

function createApp(options = {}) {
  const config = {
    dataFile: options.dataFile || path.resolve("server/data/neighborhood.json"),
    staticRoot: options.staticRoot || path.resolve("."),
    corsOrigin: options.corsOrigin || "http://localhost:3001",
    logRequests: options.logRequests !== false,
    host: options.host || "127.0.0.1",
    port: options.port || 3001,
  };
  const store = new JsonStore(config.dataFile, seedNeighborhood);
  const env = options.env || process.env;

  const server = http.createServer(async (req, res) => {
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();
    const startedAt = Date.now();
    applyBaseHeaders(req, res, config, requestId);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const body = await parseBody(req);
      const apiResult = await routeApi(req.method, url.pathname, body, store, env);
      if (apiResult) {
        sendJson(res, apiResult.status, apiResult.body, requestId);
      } else {
        serveStatic(req, res, config, requestId);
      }
      if (config.logRequests) {
        logger.info("request_completed", {
          requestId,
          method: req.method,
          path: url.pathname,
          status: res.statusCode,
          durationMs: Date.now() - startedAt,
        });
      }
    } catch (error) {
      handleError(error, res, requestId);
    }
  });

  return { server, store, config };
}

module.exports = { createApp };
