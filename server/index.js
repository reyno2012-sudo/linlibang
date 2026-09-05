const { loadEnvFile } = require("./src/env");
const { loadConfig } = require("./src/config");
const { createApp } = require("./src/app");
const { logger } = require("./src/logger");

loadEnvFile();
const config = loadConfig(process.env);
const app = createApp(config);

app.server.listen(config.port, config.host, () => {
  logger.info("server_started", {
    host: config.host,
    port: config.port,
    dataFile: config.dataFile,
  });
});

function shutdown(signal) {
  logger.info("server_shutdown_requested", { signal });
  app.server.close(() => {
    logger.info("server_shutdown_complete", { signal });
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
