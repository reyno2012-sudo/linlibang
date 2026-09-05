const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");

const { routeApi } = require("../server/src/app");
const { JsonStore } = require("../server/src/data/store");
const { AppError } = require("../server/src/errors");
const { seedNeighborhood } = require("../server/src/neighborhood/seed");

const dataFile = path.join(os.tmpdir(), "neighbortrust", "neighborhood.json");
const store = new JsonStore(dataFile, seedNeighborhood);

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return req.body.trim() ? JSON.parse(req.body) : {};
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(req, res) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("x-request-id", requestId);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const suffix = Array.isArray(req.query?.path) ? req.query.path.join("/") : req.query?.path;
    const pathname = `/api/${suffix || ""}`.replace(/\/$/, "");
    const body = await readBody(req);
    const result = await routeApi(req.method, pathname, body, store, process.env);
    if (!result) {
      res.statusCode = 404;
      res.end(JSON.stringify({ code: "NOT_FOUND", message: "接口不存在", requestId }));
      return;
    }
    res.statusCode = result.status;
    res.end(JSON.stringify(result.body));
  } catch (error) {
    const operational = error instanceof AppError && error.isOperational;
    res.statusCode = operational ? error.status : 500;
    res.end(JSON.stringify({
      code: operational ? error.code : "INTERNAL_ERROR",
      message: operational ? error.message : "服务器暂时不可用",
      details: operational ? error.details : undefined,
      requestId,
    }));
  }
};
