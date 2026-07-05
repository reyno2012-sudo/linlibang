const path = require("node:path");
const fs = require("node:fs");

function loadEnvFile(filePath = path.resolve(".env"), target = process.env) {
  if (!fs.existsSync(filePath)) return target;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (target[key] === undefined) target[key] = value;
  }
  return target;
}

function loadConfig(env = process.env) {
  loadEnvFile(path.resolve(".env"), env);
  const port = parseInt(env.PORT || "3001", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return {
    host: env.HOST || "127.0.0.1",
    port,
    dataFile: path.resolve(env.DATA_FILE || path.join("server", "data", "neighborhood.json")),
    staticRoot: path.resolve(env.STATIC_ROOT || "."),
    corsOrigin: env.CORS_ORIGIN || `http://localhost:${port}`,
    logRequests: env.LOG_REQUESTS !== "false",
  };
}

module.exports = { loadConfig, loadEnvFile };
