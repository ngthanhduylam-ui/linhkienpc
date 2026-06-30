const fs = require("fs/promises");
const path = require("path");
const config = require("./config");

function safeSegment(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "request";
}

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg", label: "jpeg" };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", extension: "png", label: "png" };
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mime: "image/webp", extension: "webp", label: "webp" };
  }
  return null;
}

function buildImageUrl(posOrigin, sku, imageId) {
  const origin = String(posOrigin || "").replace(/\/+$/, "");
  if (!config.allowedPosOrigins.has(origin)) {
    const error = new Error("POS_ORIGIN_NOT_ALLOWED");
    error.code = "POS_ORIGIN_NOT_ALLOWED";
    throw error;
  }
  return `${origin}/api/v1/public/products/${encodeURIComponent(sku)}/images/${encodeURIComponent(imageId)}/download`;
}

async function cleanupRequestTemp(requestId) {
  const requestDir = path.join(config.tempRoot, safeSegment(requestId));
  await fs.rm(requestDir, { recursive: true, force: true });
}

async function cleanupStartupTemp() {
  await fs.rm(config.tempRoot, { recursive: true, force: true });
  await fs.mkdir(config.tempRoot, { recursive: true });
}

async function fetchOneImage({ requestId, posOrigin, sku, imageId, position = 1 }) {
  const fetchStartedAt = Date.now();
  const requestDir = path.join(config.tempRoot, safeSegment(requestId));
  await fs.mkdir(requestDir, { recursive: true });

  const url = buildImageUrl(posOrigin, sku, imageId);
  const baseDiagnostic = {
    position: Number(position),
    imageId: Number(imageId),
    fetchStatus: "started"
  };
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    const wrapped = new Error("IMAGE_FETCH_FAILED");
    wrapped.code = "IMAGE_FETCH_FAILED";
    wrapped.detail = { ...baseDiagnostic, fetchStatus: "failed", message: error.message };
    throw wrapped;
  }

  if (!response.ok) {
    const error = new Error(response.status === 404 || response.status === 403 ? "IMAGE_NOT_AVAILABLE" : "IMAGE_FETCH_FAILED");
    error.code = error.message;
    error.detail = { ...baseDiagnostic, fetchStatus: "failed", status: response.status, statusText: response.statusText };
    throw error;
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > config.maxImageBytes) {
    const error = new Error("IMAGE_TOO_LARGE");
    error.code = "IMAGE_TOO_LARGE";
    error.detail = { ...baseDiagnostic, fetchStatus: "failed", contentLength };
    throw error;
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length) {
    const error = new Error("IMAGE_INVALID_SIGNATURE");
    error.code = "IMAGE_INVALID_SIGNATURE";
    throw error;
  }
  if (buffer.length > config.maxImageBytes) {
    const error = new Error("IMAGE_TOO_LARGE");
    error.code = "IMAGE_TOO_LARGE";
    error.detail = { ...baseDiagnostic, fetchStatus: "failed", byteLength: buffer.length };
    throw error;
  }

  const type = detectImageType(buffer);
  if (!type) {
    const error = new Error("IMAGE_INVALID_SIGNATURE");
    error.code = "IMAGE_INVALID_SIGNATURE";
    error.detail = {
      ...baseDiagnostic,
      fetchStatus: "failed",
      first16Hex: buffer.subarray(0, 16).toString("hex").match(/.{1,2}/g)?.join(" ") || ""
    };
    throw error;
  }

  const safePosition = String(Math.max(1, Number(position) || 1)).padStart(2, "0");
  const filePath = path.join(requestDir, `${safePosition}-image-${safeSegment(imageId)}.${type.extension}`);
  await fs.writeFile(filePath, buffer);
  const downloadDurationMs = Date.now() - fetchStartedAt;
  const diagnostic = {
    ...baseDiagnostic,
    fetchStatus: "success",
    detectedMime: type.mime,
    byteSize: buffer.length,
    tempFilename: path.basename(filePath),
    downloadDurationMs
  };
  console.info("IMAGE_FETCH_PREPARED", diagnostic);
  return {
    requestDir,
    filePath,
    url,
    byteLength: buffer.length,
    mime: type.mime,
    signature: type.label,
    position: Number(position),
    imageId: Number(imageId),
    tempFilename: path.basename(filePath),
    diagnostic
  };
}

async function fetchSelectedImages({ requestId, posOrigin, sku, images }) {
  const startedAt = Date.now();
  const requestDir = path.join(config.tempRoot, safeSegment(requestId));
  await fs.rm(requestDir, { recursive: true, force: true });
  await fs.mkdir(requestDir, { recursive: true });

  const results = [];
  const diagnostics = [];
  for (const image of images) {
    try {
      const result = await fetchOneImage({
        requestId,
        posOrigin,
        sku,
        imageId: image.id,
        position: image.position
      });
      results.push(result);
      diagnostics.push(result.diagnostic);
    } catch (error) {
      diagnostics.push({
        position: Number(image.position),
        imageId: Number(image.id),
        fetchStatus: "failed",
        error: error.code || error.message
      });
      error.detail = { ...(error.detail || {}), images: diagnostics };
      throw error;
    }
  }
  await verifyPreparedImageFiles({ requestDir, files: results, expectedCount: images.length, diagnostics });
  console.info("IMAGE_FETCH_ALL_PREPARED", {
    selectedImageCount: images.length,
    totalDownloadDurationMs: Date.now() - startedAt,
    images: diagnostics.map((item) => ({
      position: item.position,
      imageId: item.imageId,
      detectedMime: item.detectedMime,
      byteSize: item.byteSize,
      tempFilename: item.tempFilename,
      downloadDurationMs: item.downloadDurationMs
    }))
  });
  return {
    requestDir,
    files: results,
    diagnostics,
    totalDownloadDurationMs: Date.now() - startedAt
  };
}

async function verifyPreparedImageFiles({ requestDir, files, expectedCount, diagnostics }) {
  const fileNames = await fs.readdir(requestDir).catch(() => []);
  const fileDiagnostics = [];
  for (const file of files) {
    const entry = {
      position: file.position,
      imageId: file.imageId,
      tempFilename: file.tempFilename,
      exists: false,
      byteSize: 0,
      signature: "",
      supportedSignature: false
    };
    try {
      const stat = await fs.stat(file.filePath);
      const buffer = await fs.readFile(file.filePath);
      const type = detectImageType(buffer);
      entry.exists = true;
      entry.byteSize = stat.size;
      entry.signature = type?.label || "";
      entry.supportedSignature = Boolean(type);
    } catch {
      entry.exists = false;
    }
    fileDiagnostics.push(entry);
  }

  const ok =
    expectedCount === files.length &&
    expectedCount === fileNames.length &&
    fileDiagnostics.every((item) => item.exists && item.byteSize > 0 && item.supportedSignature);
  console.info("IMAGE_PREPARATION_VERIFIED", {
    selectedImageCount: expectedCount,
    tempFileCount: fileNames.length,
    files: fileDiagnostics
  });
  if (!ok) {
    const error = new Error("IMAGE_PREPARATION_COUNT_MISMATCH");
    error.code = "IMAGE_PREPARATION_COUNT_MISMATCH";
    error.detail = {
      selectedImageCount: expectedCount,
      tempFileCount: fileNames.length,
      fetchResults: diagnostics,
      files: fileDiagnostics
    };
    throw error;
  }
}

module.exports = {
  cleanupRequestTemp,
  cleanupStartupTemp,
  fetchSelectedImages,
  fetchOneImage
};
