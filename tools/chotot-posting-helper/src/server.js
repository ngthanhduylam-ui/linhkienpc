const http = require("http");
const config = require("./config");
const { getBrowserStatus, getOrCreatePostingPage } = require("./browser");
const { cleanupRequestTemp, cleanupStartupTemp, fetchOneImage, fetchSelectedImages } = require("./image-fetcher");
const { prepareListing, uploadOneImage } = require("./chotot-image-upload");

const recentRequests = [];
let activeRequestId = "";
const progressByRequest = new Map();

function sendJson(response, statusCode, payload, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  };
  if (config.allowedCorsOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  response.writeHead(statusCode, headers);
  response.end(JSON.stringify(payload));
}

function sendOptions(response, origin = "") {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600"
  };
  if (config.allowedCorsOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  response.writeHead(204, headers);
  response.end();
}

function rememberRequest(requestId) {
  if (recentRequests.includes(requestId)) return false;
  recentRequests.unshift(requestId);
  recentRequests.splice(config.recentRequestLimit);
  return true;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > config.requestBodyLimitBytes) {
        const error = new Error("REQUEST_TOO_LARGE");
        error.code = "REQUEST_TOO_LARGE";
        reject(error);
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        const error = new Error("INVALID_JSON");
        error.code = "INVALID_JSON";
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return "INVALID_PAYLOAD";
  if (payload.version !== 1) return "INVALID_PAYLOAD";
  if (!payload.requestId || typeof payload.requestId !== "string") return "INVALID_REQUEST_ID";
  if (!config.allowedPosOrigins.has(String(payload.posOrigin || "").replace(/\/+$/, ""))) return "POS_ORIGIN_NOT_ALLOWED";
  if (!payload.product || typeof payload.product.sku !== "string" || !payload.product.sku.trim()) return "PRODUCT_REQUIRED";
  if (!payload.image || !Number.isSafeInteger(Number(payload.image.id))) return "IMAGE_REQUIRED";
  return "";
}

function validateListingPayload(payload) {
  if (!payload || typeof payload !== "object") return "INVALID_PAYLOAD";
  if (payload.version !== 1) return "INVALID_PAYLOAD";
  if (!payload.requestId || typeof payload.requestId !== "string") return "INVALID_REQUEST_ID";
  if (!config.allowedPosOrigins.has(String(payload.posOrigin || "").replace(/\/+$/, ""))) return "POS_ORIGIN_NOT_ALLOWED";
  if (!payload.product || typeof payload.product.sku !== "string" || !payload.product.sku.trim()) return "PRODUCT_REQUIRED";
  if (!Array.isArray(payload.images) || payload.images.length < 1 || payload.images.length > 5) return "IMAGE_REQUIRED";
  if (!payload.images.every((image, index) => Number.isSafeInteger(Number(image.id)) && Number(image.position) === index + 1)) return "IMAGE_REQUIRED";
  if (!payload.images[0]?.isCover) return "IMAGE_REQUIRED";
  if (!payload.title || typeof payload.title !== "string") return "TITLE_FILL_FAILED";
  if (!payload.description || typeof payload.description !== "string") return "DESCRIPTION_FILL_FAILED";
  const wordCount = payload.description.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 10) return "DESCRIPTION_TOO_SHORT";
  if (payload.description.length > 1500) return "DESCRIPTION_FILL_FAILED";
  if (!Number.isSafeInteger(Number(payload.price)) || Number(payload.price) < 1000) return "PRICE_FILL_FAILED";
  if (!["new", "used_not_repaired", "used_repaired"].includes(payload.condition)) return "CONDITION_OPTION_NOT_FOUND";
  if (payload.componentType !== "computer_component") return "COMPONENT_TYPE_OPTION_NOT_FOUND";
  if (!["mainboard", "cpu", "vga", "psu", "hdd", "ssd"].includes(payload.deviceType)) return "DEVICE_OPTION_NOT_FOUND";
  return "";
}

function errorResponse(error, requestId = "") {
  const code = error?.code || error?.message || "UNEXPECTED_ERROR";
  return {
    ok: false,
    requestId,
    error: code,
    message: code,
    detail: error?.detail || null
  };
}

function setProgress(requestId, code, detail = null) {
  if (!requestId) return;
  progressByRequest.set(requestId, {
    requestId,
    code,
    detail,
    timestamp: new Date().toISOString()
  });
  console.info("HELPER_PROGRESS", { requestId, code, detail });
}

function isBrowserClosedError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("target page") && message.includes("closed") ||
    message.includes("context or browser has been closed") ||
    message.includes("browser has been closed") ||
    message.includes("page closed") ||
    message.includes("target closed")
  );
}

async function handleHealth(response, origin) {
  const browserStatus = getBrowserStatus();
  sendJson(response, 200, {
    ok: true,
    service: config.serviceName,
    version: config.version,
    browserReady: browserStatus.browserReady,
    launching: browserStatus.launching,
    lastLaunchError: browserStatus.lastLaunchError
  }, origin);
}

async function handleProgress(request, response, origin, url) {
  const requestId = url.searchParams.get("requestId") || "";
  const progress = progressByRequest.get(requestId);
  sendJson(response, 200, {
    ok: true,
    requestId,
    progress: progress || null
  }, origin);
}

async function handleTestUploadOneImage(request, response, origin) {
  let payload = null;
  let imageResult = null;
  try {
    payload = await readJsonBody(request);
    const validationError = validatePayload(payload);
    if (validationError) {
      const error = new Error(validationError);
      error.code = validationError;
      throw error;
    }
    if (!rememberRequest(payload.requestId)) {
      const error = new Error("DUPLICATE_REQUEST");
      error.code = "DUPLICATE_REQUEST";
      throw error;
    }

    imageResult = await fetchOneImage({
      requestId: payload.requestId,
      posOrigin: String(payload.posOrigin).replace(/\/+$/, ""),
      sku: payload.product.sku,
      imageId: payload.image.id
    });

    const page = await getOrCreatePostingPage();
    const uploadResult = await uploadOneImage(page, imageResult.filePath);
    sendJson(response, 200, {
      ok: true,
      requestId: payload.requestId,
      code: "ONE_IMAGE_UPLOAD_READY_FOR_REVIEW",
      message: "Uploaded one image to Cho Tot.",
      image: {
        id: Number(payload.image.id),
        byteLength: imageResult.byteLength,
        mime: imageResult.mime,
        signature: imageResult.signature,
        thumbnailCount: uploadResult.thumbnailCount
      },
      diagnostics: uploadResult.diagnostics || null
    }, origin);
  } catch (error) {
    const status = error?.code === "DUPLICATE_REQUEST" ? 409 : 400;
    sendJson(response, status, errorResponse(error, payload?.requestId || ""), origin);
  } finally {
    if (payload?.requestId) {
      await cleanupRequestTemp(payload.requestId).catch(() => {});
    }
  }
}

async function handlePrepareListing(request, response, origin) {
  let payload = null;
  let imageResult = null;
  try {
    payload = await readJsonBody(request);
    const validationError = validateListingPayload(payload);
    if (validationError) {
      const error = new Error(validationError);
      error.code = validationError;
      throw error;
    }
    if (activeRequestId) {
      const error = new Error("REQUEST_IN_PROGRESS");
      error.code = "REQUEST_IN_PROGRESS";
      throw error;
    }
    if (!rememberRequest(payload.requestId)) {
      const error = new Error("DUPLICATE_REQUEST");
      error.code = "DUPLICATE_REQUEST";
      throw error;
    }

    activeRequestId = payload.requestId;
    setProgress(payload.requestId, "UPLOADING_IMAGES");
    imageResult = await fetchSelectedImages({
      requestId: payload.requestId,
      posOrigin: String(payload.posOrigin).replace(/\/+$/, ""),
      sku: payload.product.sku,
      images: payload.images
    });
    const page = await getOrCreatePostingPage();
    const result = await prepareListing(page, payload, imageResult.files.map((image) => image.filePath), {
      requestId: payload.requestId,
      imagePreparation: imageResult.diagnostics,
      onProgress: (code, detail) => setProgress(payload.requestId, code, detail)
    });
    sendJson(response, 200, {
      ok: true,
      requestId: payload.requestId,
      code: result.code,
      message: "Đã chuẩn bị xong tin đăng. Vui lòng kiểm tra và bấm Đăng tin.",
      imageCount: payload.images.length,
      imagePreparation: imageResult.diagnostics,
      diagnostics: result.diagnostics || null,
      checks: result.checks || null,
      detailState: result.detailState || null,
      timings: result.timings || null,
      message: result.message || "ÄÃ£ chuáº©n bá»‹ xong tin Ä‘Äƒng. Vui lÃ²ng kiá»ƒm tra vÃ  báº¥m ÄÄƒng tin."
    }, origin);
  } catch (error) {
    const progress = progressByRequest.get(payload?.requestId || "");
    if (isBrowserClosedError(error)) {
      if (progress?.code === "LISTING_READY_FOR_MANUAL_POST") {
        console.info("CHOTOT_TAB_CLOSED_AFTER_READY", { requestId: payload?.requestId || "" });
        sendJson(response, 200, {
          ok: true,
          requestId: payload?.requestId || "",
          code: "SELLER_COMPLETED_OR_CLOSED_AFTER_READY",
          message: "Tin đăng đã được chuẩn bị. Cửa sổ Chợ Tốt đã được đóng hoặc chuyển trang.",
          detail: {
            closureCode: "CHOTOT_TAB_CLOSED_AFTER_READY",
            lastProgress: progress
          }
        }, origin);
        return;
      }
      error.code = "CHOTOT_TAB_CLOSED_BEFORE_READY";
      console.warn("CHOTOT_TAB_CLOSED_BEFORE_READY", { requestId: payload?.requestId || "" });
    }
    const status = error?.code === "DUPLICATE_REQUEST" || error?.code === "REQUEST_IN_PROGRESS" ? 409 : 400;
    if (imageResult?.diagnostics) {
      error.detail = { ...(error.detail || {}), imagePreparation: imageResult.diagnostics };
    }
    sendJson(response, status, errorResponse(error, payload?.requestId || ""), origin);
  } finally {
    if (activeRequestId && activeRequestId === payload?.requestId) activeRequestId = "";
    if (payload?.requestId) {
      await cleanupRequestTemp(payload.requestId).catch(() => {});
    }
  }
}

async function route(request, response) {
  const origin = request.headers.origin || "";
  if (request.method === "OPTIONS") {
    sendOptions(response, origin);
    return;
  }
  if (origin && !config.allowedCorsOrigins.has(origin)) {
    sendJson(response, 403, { ok: false, error: "ORIGIN_NOT_ALLOWED" }, "");
    return;
  }

  const url = new URL(request.url, `http://${config.host}:${config.port}`);
  if (request.method === "GET" && url.pathname === "/health") {
    await handleHealth(response, origin);
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/progress") {
    await handleProgress(request, response, origin, url);
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/test-upload-one-image") {
    await handleTestUploadOneImage(request, response, origin);
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/prepare-listing") {
    await handlePrepareListing(request, response, origin);
    return;
  }
  sendJson(response, 404, { ok: false, error: "NOT_FOUND" }, origin);
}

async function main() {
  await cleanupStartupTemp();
  const server = http.createServer((request, response) => {
    route(request, response).catch((error) => {
      sendJson(response, 500, errorResponse(error), request.headers.origin || "");
    });
  });
  server.listen(config.port, config.host, () => {
    console.log(`${config.serviceName} listening on http://${config.host}:${config.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
