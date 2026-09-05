const fs = require("node:fs");
const path = require("node:path");

function stripQuotes(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath = path.resolve(".env"), target = process.env) {
  if (!fs.existsSync(filePath)) return target;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (Object.prototype.hasOwnProperty.call(target, key)) continue;

    const value = stripQuotes(line.slice(separatorIndex + 1).trim());
    target[key] = value;
  }

  return target;
}

module.exports = { loadEnvFile };
