const path = require("path");

const helperRoot = path.resolve(__dirname, "..");
const runtimeRoot = path.join(helperRoot, ".runtime");

const config = {
  serviceName: "chotot-posting-helper",
  version: 1,
  host: "127.0.0.1",
  port: Number(process.env.CHOTOT_HELPER_PORT || 17321),
  postingUrl: "https://www.chotot.com/dang-tin",
  runtimeRoot,
  userDataDir: path.join(runtimeRoot, "chrome-profile"),
  tempRoot: path.join(runtimeRoot, "temp"),
  maxImageBytes: 15 * 1024 * 1024,
  requestBodyLimitBytes: 64 * 1024,
  allowedCorsOrigins: new Set([
    "https://vitinhphuoctai.duckdns.org",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ]),
  allowedPosOrigins: new Set([
    "https://vitinhphuoctai.duckdns.org",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]),
  recentRequestLimit: 50
};

module.exports = config;
