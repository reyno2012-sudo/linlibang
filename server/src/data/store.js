const fs = require("node:fs");
const path = require("node:path");

class JsonStore {
  constructor(dataFile, seedFactory) {
    this.dataFile = dataFile;
    this.seedFactory = seedFactory;
    this.ensureFile();
  }

  ensureFile() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    if (!fs.existsSync(this.dataFile)) {
      this.write(this.seedFactory());
      return;
    }

    const current = JSON.parse(fs.readFileSync(this.dataFile, "utf8"));
    const seed = this.seedFactory();
    if (current.schemaVersion !== seed.schemaVersion) {
      this.write(mergeSeedData(seed, current));
    }
  }

  read() {
    this.ensureFile();
    return JSON.parse(fs.readFileSync(this.dataFile, "utf8"));
  }

  write(data) {
    fs.writeFileSync(this.dataFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  update(updater) {
    const data = this.read();
    const result = updater(data);
    this.write(data);
    return result;
  }

  check() {
    const data = this.read();
    return Boolean(data && Array.isArray(data.users) && Array.isArray(data.orders));
  }
}

function mergeById(seedItems, currentItems) {
  const currentById = new Map((currentItems || []).map((item) => [item.id, item]));
  const merged = seedItems.map((seedItem) => {
    const current = currentById.get(seedItem.id);
    if (!current) return seedItem;
    return {
      ...seedItem,
      ...current,
      safety: { ...(seedItem.safety || {}), ...(current.safety || {}) },
      permissions: { ...(seedItem.permissions || {}), ...(current.permissions || {}) },
      trustBadges: current.trustBadges || seedItem.trustBadges,
      creditEvents: current.creditEvents || seedItem.creditEvents || [],
    };
  });
  const seedIds = new Set(seedItems.map((item) => item.id));
  return [...merged, ...(currentItems || []).filter((item) => !seedIds.has(item.id))];
}

function mergeSeedData(seed, current) {
  return {
    ...seed,
    ...current,
    schemaVersion: seed.schemaVersion,
    profile: { ...seed.profile, ...(current.profile || {}) },
    riskPolicy: { ...seed.riskPolicy, ...(current.riskPolicy || {}) },
    users: mergeById(seed.users, current.users),
    tools: mergeById(seed.tools, current.tools),
    feed: current.feed || seed.feed,
    orders: current.orders || [],
  };
}

module.exports = { JsonStore };
