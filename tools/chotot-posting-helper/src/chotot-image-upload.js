const config = require("./config");

const assignedUploadRequestIds = new Set();

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0111\u0110]/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function pageText(page) {
  return normalizeText(await page.locator("body").innerText({ timeout: 5000 }).catch(() => ""));
}

function hasPostingFormText(text) {
  return text.includes("hinh anh/video") || (text.includes("hinh anh") && text.includes("mo ta tin dang"));
}

function hasFinalSubmitText(text) {
  return text.includes("dang tin");
}

function hasCategoryModalText(text) {
  return text.includes("dang tin") && text.includes("chon danh muc") && text.includes("do dien tu");
}

function hasWrongCategoryFormText(text) {
  return (
    text.includes("tieu de tin tuyen dung") ||
    text.includes("mo ta vi tri tuyen dung") ||
    text.includes("nganh nghe") ||
    text.includes("so luong tuyen dung")
  );
}

function hasLoginOrBlockedText(text) {
  if (text.includes("dang nhap") || text.includes("login")) return "CHOTOT_LOGIN_REQUIRED";
  if (text.includes("captcha")) return "CAPTCHA_DETECTED";
  if (text.includes("xac minh") || text.includes("verification")) return "PAYMENT_OR_VERIFICATION_REQUIRED";
  if (text.includes("thanh toan") || text.includes("payment")) return "PAYMENT_OR_VERIFICATION_REQUIRED";
  return "";
}

async function classifyPageState(page) {
  const text = await pageText(page);
  const blocked = hasLoginOrBlockedText(text);
  if (blocked) {
    const error = new Error(blocked);
    error.code = blocked;
    throw error;
  }
  if (hasWrongCategoryFormText(text)) return "WRONG_CATEGORY_FORM";
  if (hasPostingFormText(text) && hasFinalSubmitText(text)) return "POSTING_FORM_OPEN";
  if (hasCategoryModalText(text)) return "CATEGORY_MODAL_OPEN";
  return "UNSUPPORTED_PAGE";
}

async function getCategoryDialog(page) {
  const dialog = page.locator("[role='dialog']").filter({ hasText: /Chọn danh mục|chon danh muc/i }).last();
  if (await dialog.count()) return dialog;
  return page.locator("body");
}

function getVisibleTextMeta(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return {
    text: element.innerText || element.textContent || "",
    visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"
  };
}

async function findElectronicsCategoryRow(page) {
  const dialog = await getCategoryDialog(page);
  const option = dialog.locator("button, [role='button'], li, a, div");
  const count = await option.count();
  let ambiguous = false;
  for (let index = 0; index < count; index += 1) {
    const candidate = option.nth(index);
    const meta = await candidate.evaluate(getVisibleTextMeta).catch(() => null);
    if (!meta?.visible) continue;

    const lines = String(meta.text || "")
      .split(/\r?\n/)
      .map((line) => normalizeText(line))
      .filter(Boolean);
    const labelIndex = lines.findIndex((line) => line === "do dien tu");
    if (labelIndex < 0) continue;

    const nearbyText = lines.slice(labelIndex + 1, labelIndex + 4).join(" ");
    const verifiedSubtitle = nearbyText.includes("dien thoai") || nearbyText.includes("laptop");
    if (!verifiedSubtitle) {
      ambiguous = true;
      continue;
    }

    const fullText = lines.join(" ");
    const wrongRow =
      fullText.includes("viec lam") ||
      fullText.includes("xe co") ||
      fullText.includes("bat dong san") ||
      fullText.includes("san pham khac");
    if (!wrongRow) return candidate;
  }
  const error = new Error(ambiguous ? "CHOTOT_ELECTRONICS_CATEGORY_AMBIGUOUS" : "CHOTOT_ELECTRONICS_CATEGORY_NOT_FOUND");
  error.code = error.message;
  throw error;
}

async function waitForElectronicsForm(page, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await pageText(page);
    const blocked = hasLoginOrBlockedText(text);
    if (blocked) {
      const error = new Error(blocked);
      error.code = blocked;
      throw error;
    }
    if (hasWrongCategoryFormText(text)) {
      const error = new Error("CHOTOT_WRONG_CATEGORY_FORM");
      error.code = "CHOTOT_WRONG_CATEGORY_FORM";
      throw error;
    }
    if (hasPostingFormText(text) && hasFinalSubmitText(text)) return text;
    await page.waitForTimeout(300);
  }
  const error = new Error("CHOTOT_POSTING_FORM_TIMEOUT");
  error.code = "CHOTOT_POSTING_FORM_TIMEOUT";
  throw error;
}

async function ensurePostingFormReady(page) {
  let state = await classifyPageState(page);
  if (state === "POSTING_FORM_OPEN") {
    console.log("POSTING_FORM_ALREADY_OPEN");
    return;
  }

  if (state === "WRONG_CATEGORY_FORM" || state !== "CATEGORY_MODAL_OPEN") {
    await page.goto(config.postingUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1000);
    state = await classifyPageState(page);
  }

  if (state !== "CATEGORY_MODAL_OPEN") {
    const error = new Error("CHOTOT_POSTING_FORM_NOT_FOUND");
    error.code = "CHOTOT_POSTING_FORM_NOT_FOUND";
    throw error;
  }

  console.log("CATEGORY_MODAL_DETECTED");
  const electronicsRow = await findElectronicsCategoryRow(page);
  console.log("ELECTRONICS_ROW_VERIFIED");
  await electronicsRow.click();
  console.log("ELECTRONICS_ROW_CLICKED");
  console.log("WAITING_FOR_ELECTRONICS_FORM");
  await waitForElectronicsForm(page);
  console.log("ELECTRONICS_FORM_READY");
}

async function findImageUploadInput(page) {
  const count = await page.locator("input[type='file']").count();
  for (let index = 0; index < count; index += 1) {
    const candidate = page.locator("input[type='file']").nth(index);
    const meta = await candidate.evaluate((element) => {
      const accept = element.getAttribute("accept") || "";
      const disabled = element.disabled || element.getAttribute("aria-disabled") === "true";
      const parts = [];
      let current = element;
      for (let depth = 0; current && depth < 8; depth += 1) {
        parts.push(current.innerText || current.textContent || "");
        current = current.parentElement;
      }
      return { accept, disabled, nearby: parts.join(" ") };
    }).catch(() => null);
    const accept = normalizeText(meta?.accept || "");
    const nearby = normalizeText(meta?.nearby || "");
    const acceptsImages = accept.includes("image") || accept.includes("jpg") || accept.includes("jpeg") || accept.includes("png") || accept.includes("webp");
    const inImageSection = nearby.includes("hinh anh/video") || nearby.includes("hinh anh") || nearby.includes("them anh");
    if (meta && !meta.disabled && acceptsImages && inImageSection) return candidate;
  }
  const error = new Error("IMAGE_INPUT_NOT_FOUND");
  error.code = "IMAGE_INPUT_NOT_FOUND";
  throw error;
}

async function getUploadDiagnostics(page) {
  return page.evaluate(() => {
    function normalize(value = "") {
      return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u0111\u0110]/g, "d")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }
    function visible(element, minSize = 20) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width >= minSize && rect.height >= minSize && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
    }
    function scoreUploadSection(element) {
      const text = normalize(element.innerText || element.textContent || "");
      let score = 0;
      if (text.includes("hinh anh/video")) score += 8;
      if (text.includes("hinh anh")) score += 4;
      if (text.includes("them anh") || text.includes("them anh/video")) score += 3;
      score += element.querySelectorAll("input[type='file']").length * 3;
      return score;
    }

    const sectionCandidates = [];
    for (const input of document.querySelectorAll("input[type='file']")) {
      let current = input.parentElement;
      for (let depth = 0; current && depth < 8; depth += 1) {
        const score = scoreUploadSection(current);
        if (score > 0) sectionCandidates.push({ element: current, score, depth });
        current = current.parentElement;
      }
    }
    sectionCandidates.sort((left, right) => right.score - left.score || left.depth - right.depth);
    const section = sectionCandidates[0]?.element || null;
    if (!section) {
      return {
        visibleImgCount: 0,
        visibleRemoveButtonCount: 0,
        uploadTileCount: 0,
        realThumbnailCount: 0,
        processingIndicatorCount: 0,
        hasProcessingIndicator: false
      };
    }

    const uploadTiles = [...section.querySelectorAll("button, label, div")].filter((node) => {
      if (!visible(node)) return false;
      const text = normalize(node.innerText || node.textContent || "");
      return text.includes("them anh") || text.includes("them anh/video");
    });
    const removeButtons = [...section.querySelectorAll("button, [role='button'], span, div")].filter((node) => {
      if (!visible(node, 8)) return false;
      const text = normalize(node.innerText || node.textContent || node.getAttribute("aria-label") || node.getAttribute("title") || "");
      const rect = node.getBoundingClientRect();
      return rect.width <= 56 && rect.height <= 56 && (text === "x" || text === "\u00d7" || text.includes("xoa") || text.includes("remove") || text.includes("delete"));
    });
    const processingIndicators = [...section.querySelectorAll("[role='progressbar'], [aria-busy='true'], [aria-label], [class], span, div")].filter((node) => {
      if (!visible(node, 8)) return false;
      const text = normalize(node.innerText || node.textContent || node.getAttribute("aria-label") || node.getAttribute("title") || "");
      const className = normalize(node.getAttribute("class") || "");
      return (
        text.includes("dang tai") ||
        text.includes("dang xu ly") ||
        text.includes("uploading") ||
        text.includes("processing") ||
        text.includes("loading") ||
        className.includes("spinner") ||
        className.includes("loading") ||
        className.includes("progress")
      );
    });
    function isRealPreviewImage(image) {
      if (!visible(image, 40)) return false;
      const src = image.currentSrc || image.src || "";
      const alt = normalize(image.getAttribute("alt") || "");
      const className = normalize(image.getAttribute("class") || "");
      const nearby = normalize(image.closest("div")?.innerText || "");
      const decorative =
        !src ||
        src.startsWith("data:image/svg") ||
        /logo|avatar|icon|placeholder|empty|default|add|upload/i.test(src) ||
        alt.includes("icon") ||
        alt.includes("logo") ||
        className.includes("icon");
      const insideEmptyTile = nearby.includes("them anh") || nearby.includes("them anh/video");
      return !decorative && !insideEmptyTile;
    }

    function findPreviewCard(node) {
      let current = node;
      for (let depth = 0; current && current !== section && depth < 8; depth += 1) {
        const text = normalize(current.innerText || current.textContent || "");
        const previewImages = [...current.querySelectorAll("img")].filter(isRealPreviewImage);
        const associatedRemoveButtons = removeButtons.filter((button) => current.contains(button));
        if (previewImages.length > 0 && associatedRemoveButtons.length > 0 && !text.includes("them anh")) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    }

    const visibleImages = [...section.querySelectorAll("img")].filter(isRealPreviewImage);
    const previewCards = new Set();
    for (const removeButton of removeButtons) {
      const card = findPreviewCard(removeButton);
      if (card) previewCards.add(card);
    }
    return {
      visibleImgCount: visibleImages.length,
      visibleRemoveButtonCount: removeButtons.length,
      uploadTileCount: uploadTiles.length,
      realThumbnailCount: previewCards.size,
      realPreviewCardCount: previewCards.size,
      processingIndicatorCount: processingIndicators.length,
      hasProcessingIndicator: processingIndicators.length > 0
    };
  });
}

async function hasInvalidImageMessage(page) {
  const text = await pageText(page);
  return (
    text.includes("khong phai dinh dang") ||
    text.includes("jpg png gif hoac bmp") ||
    text.includes("tai anh that bai") ||
    text.includes("anh khong hop le")
  );
}

function getImageProcessingTimeoutMs(expectedCount) {
  if (expectedCount <= 1) return 20000;
  if (expectedCount <= 3) return 30000;
  return 45000;
}

function buildUploadDiagnostics({ uploadStrategy, expectedCount, filePaths, uploadCompletedAt, startedAt, diagnostics, extra = {} }) {
  return {
    uploadStrategy,
    expectedCount,
    fileCount: filePaths.length,
    detectedRealThumbnailCount: diagnostics.realThumbnailCount,
    verificationElapsedMs: Date.now() - startedAt,
    uploadCompletedAt,
    ...diagnostics,
    ...extra
  };
}

async function waitForImageProcessing(page, { expectedCount, filePaths, uploadStrategy, uploadCompletedAt, beforeDiagnostics, context }) {
  const startedAt = Date.now();
  const totalTimeoutMs = getImageProcessingTimeoutMs(expectedCount);
  const deadline = startedAt + totalTimeoutMs;
  let lastDiagnostics = beforeDiagnostics;
  let lastCount = beforeDiagnostics.realThumbnailCount;
  let lastProgressAt = startedAt;
  let firstThumbnailAt = 0;
  let stableSince = 0;
  let countIncreased = false;

  console.log("WAITING_FOR_IMAGE_PROCESSING", { expectedCount, totalTimeoutMs });
  emitProgress(context, "WAITING_FOR_IMAGE_PROCESSING", {
    expectedCount,
    detectedRealThumbnailCount: lastCount
  });

  while (Date.now() < deadline) {
    if (await hasInvalidImageMessage(page)) {
      const error = new Error("IMAGE_UPLOAD_REJECTED");
      error.code = "IMAGE_UPLOAD_REJECTED";
      error.detail = buildUploadDiagnostics({
        uploadStrategy,
        expectedCount,
        filePaths,
        uploadCompletedAt,
        startedAt,
        diagnostics: lastDiagnostics,
        extra: { timeoutReason: "invalid_image_message" }
      });
      throw error;
    }

    lastDiagnostics = await getUploadDiagnostics(page);
    const count = lastDiagnostics.realThumbnailCount;
    if (count !== lastCount) {
      const elapsedMs = Date.now() - startedAt;
      if (count > lastCount) countIncreased = true;
      if (count > 0 && !firstThumbnailAt) firstThumbnailAt = Date.now();
      lastCount = count;
      lastProgressAt = Date.now();
      stableSince = 0;
      console.log("IMAGE_COUNT_PROGRESS", {
        expectedCount,
        detectedRealThumbnailCount: count,
        visibleRemoveButtonCount: lastDiagnostics.visibleRemoveButtonCount,
        uploadTileCount: lastDiagnostics.uploadTileCount,
        processingIndicatorCount: lastDiagnostics.processingIndicatorCount,
        elapsedMs
      });
      emitProgress(context, "IMAGE_COUNT_PROGRESS", {
        expectedCount,
        detectedRealThumbnailCount: count
      });
    }

    if (count === expectedCount) {
      if (!stableSince) {
        stableSince = Date.now();
        console.log("IMAGE_COUNT_REACHED_EXPECTED", {
          expectedCount,
          elapsedMs: Date.now() - startedAt
        });
      }
      if (Date.now() - stableSince >= 2000) {
        const stableDiagnostics = await getUploadDiagnostics(page);
        const stableCount = stableDiagnostics.realThumbnailCount;
        if (stableCount === expectedCount && !stableDiagnostics.hasProcessingIndicator) {
          const verificationElapsedMs = Date.now() - startedAt;
          console.log("IMAGES_READY", {
            expectedCount,
            actualCount: stableCount,
            firstThumbnailMs: firstThumbnailAt ? firstThumbnailAt - startedAt : null,
            finalStableMs: verificationElapsedMs
          });
          emitProgress(context, "IMAGES_READY", {
            expectedCount,
            detectedRealThumbnailCount: stableCount
          });
          return {
            ready: true,
            thumbnailCount: stableCount,
            diagnostics: buildUploadDiagnostics({
              uploadStrategy,
              expectedCount,
              filePaths,
              uploadCompletedAt,
              startedAt,
              diagnostics: stableDiagnostics,
              extra: {
                totalTimeoutMs,
                countIncreased,
                firstThumbnailMs: firstThumbnailAt ? firstThumbnailAt - startedAt : null,
                finalStableMs: verificationElapsedMs,
                timeoutReason: ""
              }
            })
          };
        }
        if (stableCount === expectedCount) {
          console.info("IMAGES_VISIBLE_VERIFICATION_UNCERTAIN", {
            expectedCount,
            detectedRealThumbnailCount: stableCount,
            processingIndicatorCount: stableDiagnostics.processingIndicatorCount
          });
          return {
            ready: true,
            warningCode: "IMAGES_VISIBLE_VERIFICATION_UNCERTAIN",
            warningMessage: "Ảnh đã xuất hiện đầy đủ, helper tiếp tục chuẩn bị tin đăng.",
            thumbnailCount: stableCount,
            diagnostics: buildUploadDiagnostics({
              uploadStrategy,
              expectedCount,
              filePaths,
              uploadCompletedAt,
              startedAt,
              diagnostics: stableDiagnostics,
              extra: {
                totalTimeoutMs,
                countIncreased,
                firstThumbnailMs: firstThumbnailAt ? firstThumbnailAt - startedAt : null,
                finalStableMs: Date.now() - startedAt,
                timeoutReason: "processing_indicator_still_visible"
              }
            })
          };
        }
        stableSince = 0;
      }
    } else {
      stableSince = 0;
    }

    await page.waitForTimeout(400);
  }

  const finalDiagnostics = await getUploadDiagnostics(page).catch(() => lastDiagnostics);
  const finalCount = finalDiagnostics.realThumbnailCount;
  const timeoutReason = finalCount > 0 ? "partial_thumbnail_timeout" : "no_thumbnail_timeout";
  const diagnostics = buildUploadDiagnostics({
    uploadStrategy,
    expectedCount,
    filePaths,
    uploadCompletedAt,
    startedAt,
    diagnostics: finalDiagnostics,
    extra: {
      totalTimeoutMs,
      countIncreased,
      timeSinceLastProgressMs: Date.now() - lastProgressAt,
      firstThumbnailMs: firstThumbnailAt ? firstThumbnailAt - startedAt : null,
      timeoutReason
    }
  });

  console.warn("IMAGE_PROCESSING_TIMEOUT", diagnostics);
  if (finalCount >= expectedCount && finalDiagnostics.visibleRemoveButtonCount >= expectedCount) {
    console.info("IMAGES_VISIBLE_VERIFICATION_UNCERTAIN", diagnostics);
    return {
      ready: true,
      warningCode: "IMAGES_VISIBLE_VERIFICATION_UNCERTAIN",
      warningMessage: "Ảnh đã xuất hiện đầy đủ, helper tiếp tục chuẩn bị tin đăng.",
      thumbnailCount: finalCount,
      diagnostics
    };
  }

  return {
    ready: false,
    code: finalCount > 0 ? "IMAGE_PROCESSING_PARTIAL_TIMEOUT" : "IMAGE_THUMBNAIL_VERIFICATION_TIMEOUT",
    message: finalCount > 0
      ? `Chợ Tốt đang xử lý ảnh lâu hơn bình thường. Hiện đã thấy ${finalCount}/${expectedCount} ảnh. Vui lòng chờ thêm hoặc thử lại.`
      : "Chợ Tốt đang xử lý ảnh lâu hơn bình thường. Vui lòng kiểm tra ảnh trên form rồi thử lại.",
    thumbnailCount: finalCount,
    diagnostics
  };
}

async function uploadImages(page, filePaths, expectedCount, context = {}) {
  await ensurePostingFormReady(page);
  const beforeDiagnostics = await getUploadDiagnostics(page);
  if (beforeDiagnostics.realThumbnailCount > 0) {
    const error = new Error("CHOTOT_EXISTING_IMAGES");
    error.code = "CHOTOT_EXISTING_IMAGES";
    error.detail = beforeDiagnostics;
    throw error;
  }

  const uploadStrategy = "single_setInputFiles_array";
  console.log("UPLOADING_IMAGES", { uploadStrategy, expectedCount, fileCount: filePaths.length });
  const requestId = context.requestId || "";
  let uploadCompletedAt = "";
  let setInputFilesMs = 0;
  if (!requestId || !assignedUploadRequestIds.has(requestId)) {
    const input = await findImageUploadInput(page);
    const setInputFilesStartedAt = Date.now();
    try {
      await input.setInputFiles(filePaths);
    } catch (error) {
      const wrapped = new Error("IMAGE_UPLOAD_COMMAND_FAILED");
      wrapped.code = "IMAGE_UPLOAD_COMMAND_FAILED";
      wrapped.detail = { uploadStrategy, expectedCount, fileCount: filePaths.length, message: error.message };
      throw wrapped;
    }
    setInputFilesMs = Date.now() - setInputFilesStartedAt;
    uploadCompletedAt = new Date().toISOString();
    if (requestId) assignedUploadRequestIds.add(requestId);
    console.log("IMAGE_FILES_ASSIGNED", {
      uploadStrategy,
      expectedCount,
      fileCount: filePaths.length,
      uploadCompletedAt,
      setInputFilesMs
    });
    emitProgress(context, "IMAGE_FILES_ASSIGNED", { expectedCount, detectedRealThumbnailCount: 0 });
  } else {
    uploadCompletedAt = new Date().toISOString();
    console.warn("IMAGE_FILES_ALREADY_ASSIGNED_FOR_REQUEST", { requestId, expectedCount });
  }

  const result = await waitForImageProcessing(page, {
    expectedCount,
    filePaths,
    uploadStrategy,
    uploadCompletedAt,
    beforeDiagnostics,
    context
  });
  result.diagnostics = {
    ...(result.diagnostics || {}),
    setInputFilesMs
  };
  return result;
}

async function uploadOneImage(page, filePath) {
  return uploadImages(page, [filePath], 1);
}

function wordCount(value = "") {
  return String(value).trim().split(/\s+/).filter(Boolean).length;
}

async function findFieldContainer(page, labelText, errorCode, options = {}) {
  const normalizedLabel = normalizeText(labelText);
  const forbiddenLabels = (options.forbiddenLabels || []).map(normalizeText);
  const requiredText = (options.requiredText || []).map(normalizeText);
  const labels = page.locator("label, div, span, p").filter({ hasText: new RegExp(labelText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
  const count = await labels.count();
  for (let index = 0; index < count; index += 1) {
    const label = labels.nth(index);
    const matches = await label.evaluate((element, expected) => {
      function normalize(value = "") {
        return String(value)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[\u0111\u0110]/g, "d")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }
      function visible(node) {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }
      if (!visible(element)) return null;
      if (!normalize(element.innerText || element.textContent || "").includes(expected)) return null;
      return true;
    }, normalizedLabel).catch(() => null);
    if (!matches) continue;

    for (let depth = 0; depth <= 6; depth += 1) {
      const path = depth === 0 ? "xpath=." : `xpath=${"../".repeat(depth).replace(/\/$/, "")}`;
      const container = label.locator(path).first();
      if (!(await container.count())) continue;
      const meta = await container.evaluate((element, args) => {
        function normalize(value = "") {
          return String(value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[\u0111\u0110]/g, "d")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        }
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const text = normalize(element.innerText || element.textContent || "");
        return {
          text,
          visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden",
          hasEditable: Boolean(element.querySelector("input, textarea, [contenteditable='true'], [role='combobox'], button")),
          hasLabel: text.includes(args.normalizedLabel),
          hasForbidden: args.forbiddenLabels.some((label) => text.includes(label)),
          hasRequired: args.requiredText.every((item) => text.includes(item))
        };
      }, { normalizedLabel, forbiddenLabels, requiredText }).catch(() => null);
      if (meta?.visible && meta.hasEditable && meta.hasLabel && !meta.hasForbidden && meta.hasRequired) {
        return container;
      }
    }
  }
  const error = new Error(errorCode);
  error.code = errorCode;
  throw error;
}

async function findVisibleInContainer(container, selector, errorCode, assertFn = null) {
  const locator = container.locator(selector);
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    if (assertFn && !(await assertFn(candidate))) continue;
    return candidate;
  }
  const error = new Error(errorCode);
  error.code = errorCode;
  throw error;
}

async function getFieldTextValue(field) {
  return field.evaluate((element) => {
    if (element.isContentEditable) return element.innerText || element.textContent || "";
    return element.value || "";
  }).catch(() => "");
}

async function fillTextField(page, { label, value, fieldNotFoundCode, fillFailedCode, scopeMismatchCode, verify, containerOptions = {}, editableSelector = "textarea, input, [contenteditable='true']", assertEditable = null }) {
  const container = await findFieldContainer(page, label, scopeMismatchCode || fieldNotFoundCode, containerOptions);
  const input = await findVisibleInContainer(container, editableSelector, fieldNotFoundCode, assertEditable);
  await input.scrollIntoViewIfNeeded().catch(() => {});
  await input.click({ timeout: 5000 }).catch(() => {});
  await input.fill(String(value), { timeout: 10000 });
  await page.waitForTimeout(700);
  const actual = await getFieldTextValue(input);
  if (!verify(String(actual))) {
    const error = new Error(fillFailedCode);
    error.code = fillFailedCode;
    throw error;
  }
  return { container, input };
}

async function fillDescription(page, description) {
  if (description.length > 1500) {
    const error = new Error("DESCRIPTION_TOO_LONG");
    error.code = "DESCRIPTION_TOO_LONG";
    throw error;
  }
  if (wordCount(description) < 10) {
    const error = new Error("DESCRIPTION_TOO_SHORT");
    error.code = "DESCRIPTION_TOO_SHORT";
    throw error;
  }

  console.log("FILLING_DESCRIPTION");
  console.log("DESCRIPTION_FIELD_FIND_START");
  await fillTextField(page, {
    label: "Mô tả tin đăng",
    value: description,
    fieldNotFoundCode: "DESCRIPTION_FIELD_NOT_FOUND",
    fillFailedCode: "DESCRIPTION_FILL_FAILED",
    scopeMismatchCode: "DESCRIPTION_FIELD_SCOPE_MISMATCH",
    containerOptions: {
      forbiddenLabels: ["Tiêu đề tin đăng", "Giá bán", "Địa chỉ"]
    },
    editableSelector: "textarea",
    verify: (actual) => actual.trim() === description.trim()
  });
  console.log("DESCRIPTION_FIELD_FOUND");
  console.log("DESCRIPTION_FILLED");

  const container = await findFieldContainer(page, "Mô tả tin đăng", "DESCRIPTION_CONFIRM_FAILED", {
    forbiddenLabels: ["Tiêu đề tin đăng", "Giá bán", "Địa chỉ"]
  }).catch(() => null);
  if (container) {
    const doneButton = container.locator("button").filter({ hasText: /^Xong$/i }).first();
    if (await doneButton.isVisible().catch(() => false)) {
      console.log("DESCRIPTION_CONFIRM_START");
      await doneButton.click();
      await page.waitForTimeout(700);
      console.log("DESCRIPTION_CONFIRMED");
      return true;
    }
  }
  return false;
}

async function waitForChoTotAiRender(page, timeoutMs = 45000) {
  console.log("WAITING_FOR_CHOTOT_AI_RENDER");
  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;
  let lastTitle = "";
  while (Date.now() < deadline) {
    const text = await pageText(page);
    const blocked = hasLoginOrBlockedText(text);
    if (blocked) {
      const error = new Error(blocked);
      error.code = blocked;
      throw error;
    }
    const transient =
      text.includes("dang tao") ||
      text.includes("dang viet") ||
      text.includes("ai dang") ||
      text.includes("dang xu ly") ||
      text.includes("vui long cho");
    const fieldsPresent =
      text.includes("tieu de tin dang") &&
      text.includes("gia ban") &&
      text.includes("thong tin chi tiet");
    let titleValue = "";
    if (fieldsPresent) {
      titleValue = await readScopedFieldValue(page, {
        label: "Tiêu đề tin đăng",
        fieldNotFoundCode: "TITLE_FIELD_NOT_FOUND",
        scopeMismatchCode: "TITLE_FIELD_SCOPE_MISMATCH",
        forbiddenLabels: ["Mô tả tin đăng", "Giá bán", "Địa chỉ"],
        editableSelector: "input"
      }).catch(() => "");
    }
    if (fieldsPresent && !transient && titleValue === lastTitle) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= 1800) {
        console.log("CHOTOT_AI_RENDER_COMPLETE");
        console.log("RELOCATING_ALL_FIELDS");
        return;
      }
    } else {
      stableSince = 0;
      lastTitle = titleValue;
    }
    await page.waitForTimeout(300);
  }
  const error = new Error("CHOTOT_AI_RENDER_TIMEOUT");
  error.code = "CHOTOT_AI_RENDER_TIMEOUT";
  throw error;
}

async function waitForRemainingFields(page, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await pageText(page);
    const blocked = hasLoginOrBlockedText(text);
    if (blocked) {
      const error = new Error(blocked);
      error.code = blocked;
      throw error;
    }
    if (
      text.includes("tieu de tin dang") &&
      text.includes("gia ban") &&
      text.includes("thong tin chi tiet")
    ) {
      console.log("REMAINING_FIELDS_READY");
      return;
    }
    await page.waitForTimeout(300);
  }
  const error = new Error("REMAINING_FIELDS_TIMEOUT");
  error.code = "REMAINING_FIELDS_TIMEOUT";
  throw error;
}

async function readScopedFieldValue(page, { label, fieldNotFoundCode, scopeMismatchCode, forbiddenLabels = [], requiredText = [], editableSelector = "textarea, input, [contenteditable='true']" }) {
  const container = await findFieldContainer(page, label, scopeMismatchCode || fieldNotFoundCode, {
    forbiddenLabels,
    requiredText
  });
  const input = await findVisibleInContainer(container, editableSelector, fieldNotFoundCode);
  return getFieldTextValue(input);
}

async function fillPrice(page, payload) {
  console.log("FILLING_PRICE");
  const price = payload.price;
  const digits = String(Number(price));
  if (!Number.isSafeInteger(Number(price)) || Number(price) < 1000) {
    const error = new Error("PRICE_FILL_FAILED");
    error.code = "PRICE_FILL_FAILED";
    throw error;
  }
  await fillTextField(page, {
    label: "Giá bán",
    value: digits,
    fieldNotFoundCode: "PRICE_FIELD_NOT_FOUND",
    fillFailedCode: "PRICE_FILL_FAILED",
    scopeMismatchCode: "PRICE_FIELD_SCOPE_MISMATCH",
    containerOptions: {
      forbiddenLabels: ["Mô tả tin đăng", "Tiêu đề tin đăng", "Địa chỉ"],
      requiredText: ["đ"]
    },
    editableSelector: "input",
    assertEditable: async (candidate) => {
      return candidate.evaluate((element) => element.tagName.toLowerCase() === "input").catch(() => false);
    },
    verify: (actual) => actual.replace(/\D/g, "") === digits
  });
  await page.waitForTimeout(500);
  const priceAfterFill = await readScopedFieldValue(page, {
    label: "Giá bán",
    fieldNotFoundCode: "PRICE_FIELD_NOT_FOUND",
    scopeMismatchCode: "PRICE_FIELD_SCOPE_MISMATCH",
    forbiddenLabels: ["Mô tả tin đăng", "Tiêu đề tin đăng", "Địa chỉ"],
    requiredText: ["đ"],
    editableSelector: "input"
  }).catch(() => "");
  const descriptionAfterPrice = await readScopedFieldValue(page, {
    label: "Mô tả tin đăng",
    fieldNotFoundCode: "DESCRIPTION_FIELD_NOT_FOUND",
    scopeMismatchCode: "DESCRIPTION_FIELD_SCOPE_MISMATCH",
    forbiddenLabels: ["Tiêu đề tin đăng", "Giá bán", "Địa chỉ"],
    editableSelector: "textarea"
  }).catch(() => "");
  const text = await pageText(page);
  if (
    priceAfterFill.replace(/\D/g, "") !== digits ||
    descriptionAfterPrice.trim() !== payload.description.trim() ||
    text.includes("vui long dien toi thieu 1.000")
  ) {
    const error = new Error("PRICE_STATE_NOT_PERSISTED");
    error.code = "PRICE_STATE_NOT_PERSISTED";
    error.detail = {
      priceStillCorrect: priceAfterFill.replace(/\D/g, "") === digits,
      descriptionStillCorrect: descriptionAfterPrice.trim() === payload.description.trim(),
      minimumPriceValidationVisible: text.includes("vui long dien toi thieu 1.000")
    };
    throw error;
  }
  console.log("PRICE_FILLED");
}

async function waitForFastPriceReady(page, context = {}, timeoutMs = 8000) {
  console.log("FAST_PRICE_WAITING");
  emitProgress(context, "FAST_PRICE_WAITING");
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  while (Date.now() < deadline) {
    const container = await findFieldContainer(page, "Giá bán", "PRICE_FIELD_SCOPE_MISMATCH", {
      forbiddenLabels: ["Mô tả tin đăng", "Tiêu đề tin đăng", "Địa chỉ"],
      requiredText: ["đ"]
    }).catch(() => null);
    if (container) {
      const input = await findVisibleInContainer(
        container,
        "input",
        "PRICE_FIELD_NOT_FOUND",
        async (candidate) => candidate.evaluate((element) => element.tagName.toLowerCase() === "input").catch(() => false)
      ).catch(() => null);
      if (input) {
        console.log("FAST_PRICE_READY", { detectionMs: Date.now() - startedAt });
        emitProgress(context, "FAST_PRICE_READY");
        return;
      }
    }
    await page.waitForTimeout(150);
  }
  const error = new Error("PRICE_FIELD_NOT_FOUND");
  error.code = "PRICE_FIELD_NOT_FOUND";
  throw error;
}

async function fillPriceWithFastRetry(page, payload, context = {}, maxAttempts = 3) {
  const startedAt = Date.now();
  await waitForFastPriceReady(page, context);
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await fillPrice(page, payload);
      console.log("FAST_PRICE_FILLED", { fillVerifyMs: Date.now() - startedAt, attempt });
      emitProgress(context, "FAST_PRICE_FILLED");
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      await page.waitForTimeout(250);
    }
  }
  throw lastError;
}

async function ensureDescriptionMatchesPayload(page, payload) {
  const expected = payload.description.trim();
  const current = await readScopedFieldValue(page, {
    label: "Mô tả tin đăng",
    fieldNotFoundCode: "DESCRIPTION_FIELD_NOT_FOUND",
    scopeMismatchCode: "DESCRIPTION_FIELD_SCOPE_MISMATCH",
    forbiddenLabels: ["Tiêu đề tin đăng", "Giá bán", "Địa chỉ"],
    editableSelector: "textarea"
  });
  if (current.trim() === expected) return;

  const currentDigits = current.replace(/\D/g, "");
  if (currentDigits && currentDigits === String(Number(payload.price))) {
    console.log("DESCRIPTION_RESTORED_AFTER_FIELD_MISWRITE");
  } else {
    console.log("DESCRIPTION_RESTORED_AFTER_AI_RENDER");
  }
  await fillTextField(page, {
    label: "Mô tả tin đăng",
    value: expected,
    fieldNotFoundCode: "DESCRIPTION_FIELD_NOT_FOUND",
    fillFailedCode: "DESCRIPTION_FILL_FAILED",
    scopeMismatchCode: "DESCRIPTION_FIELD_SCOPE_MISMATCH",
    containerOptions: {
      forbiddenLabels: ["Tiêu đề tin đăng", "Giá bán", "Địa chỉ"]
    },
    editableSelector: "textarea",
    verify: (actual) => actual.trim() === expected
  });
}

async function findOptionByText(page, optionText, errorCode) {
  const expected = normalizeText(optionText);
  const options = page.locator("[role='option'], li, button, div, span").filter({ hasText: new RegExp(optionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
  const count = await options.count();
  for (let pass = 0; pass < 2; pass += 1) {
    for (let index = 0; index < count; index += 1) {
      const candidate = options.nth(index);
      const meta = await candidate.evaluate(getVisibleTextMeta).catch(() => null);
      if (!meta?.visible) continue;
      const actual = normalizeText(meta.text);
      if ((pass === 0 && actual === expected) || (pass === 1 && actual.includes(expected))) return candidate;
    }
  }
  const error = new Error(errorCode);
  error.code = errorCode;
  throw error;
}

async function getVisibleOptionTexts(page) {
  return page.locator("[role='option'], li, button, div, span").evaluateAll((elements) => {
    function visible(element) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }
    return elements
      .filter(visible)
      .map((element) => (element.innerText || element.textContent || "").trim())
      .filter(Boolean)
      .slice(0, 40);
  }).catch(() => []);
}

function getFieldProgressPrefix(errorCode) {
  if (errorCode.startsWith("CONDITION_")) return "CONDITION";
  if (errorCode.startsWith("COMPONENT_TYPE_")) return "COMPONENT_TYPE";
  if (errorCode.startsWith("DEVICE_")) return "DEVICE";
  if (errorCode.startsWith("CATEGORY_DETAIL_")) return "CATEGORY_DETAIL";
  return "";
}

async function selectFieldOption(page, { label, optionText, errorCode, optional = false }) {
  try {
    if (!optionText) return false;
    const currentText = await pageText(page);
    if (currentText.includes(normalizeText(optionText))) return true;
    const container = await findFieldContainer(page, label, errorCode);
    const prefix = getFieldProgressPrefix(errorCode);
    if (prefix) console.log(`${prefix}_FIELD_FOUND`);
    const clickable = await findVisibleInContainer(container, "button, [role='combobox'], input, div", errorCode);
    await clickable.scrollIntoViewIfNeeded().catch(() => {});
    await clickable.click({ timeout: 5000 });
    if (prefix) console.log(`${prefix}_OPTIONS_OPEN`);
    await page.waitForTimeout(500);
    const option = await findOptionByText(page, optionText, errorCode);
    if (prefix) console.log(`${prefix}_OPTION_FOUND`);
    await option.click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const nextText = await pageText(page);
    if (!nextText.includes(normalizeText(optionText))) {
      const error = new Error(errorCode);
      error.code = errorCode;
      throw error;
    }
    return true;
  } catch (error) {
    error.detail = {
      ...(error.detail || {}),
      nearbyFieldLabel: label,
      expectedOptionText: optionText,
      visibleOptionTexts: await getVisibleOptionTexts(page),
      currentPageTextSample: (await pageText(page).catch(() => "")).slice(0, 500)
    };
    if (optional) {
      console.warn(error.code || error.message);
      return false;
    }
    throw error;
  }
}

const REQUIRED_DETAIL_FIELDS = [
  { key: "categoryDetail", label: "Danh mục", displayName: "danh mục" },
  { key: "condition", label: "Tình trạng", displayName: "tình trạng" },
  { key: "componentType", label: "Loại linh kiện", displayName: "loại linh kiện" },
  { key: "deviceType", label: "Thiết bị", displayName: "thiết bị" }
];

function isMeaningfulFieldLine(line, label) {
  const normalizedLine = normalizeText(line);
  const normalizedLabel = normalizeText(label);
  const valueOnly = normalizedLine.replace(normalizedLabel, "").trim();
  if (!valueOnly) return false;
  if (valueOnly === "*" || valueOnly === ":") return false;
  if (valueOnly.includes("chon ") || valueOnly.startsWith("chon")) return false;
  if (valueOnly.includes("vui long")) return false;
  if (valueOnly.includes("bat buoc")) return false;
  if (valueOnly.includes("thong tin chi tiet")) return false;
  return true;
}

async function readFieldDisplayState(page, field) {
  try {
    const container = await findFieldContainer(page, field.label, "FIELD_NOT_FOUND");
    const lines = await container.evaluate((element) => {
      return (element.innerText || element.textContent || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    });
    const valueLines = lines.filter((line) => isMeaningfulFieldLine(line, field.label));
    return {
      key: field.key,
      label: field.label,
      displayName: field.displayName,
      populated: valueLines.length > 0,
      value: valueLines.join(" · ")
    };
  } catch {
    return {
      key: field.key,
      label: field.label,
      displayName: field.displayName,
      populated: false,
      value: ""
    };
  }
}

async function inspectAiSelectedFields(page) {
  const requiredFields = [];
  for (const field of REQUIRED_DETAIL_FIELDS) {
    requiredFields.push(await readFieldDisplayState(page, field));
  }
  const titleValue = await readScopedFieldValue(page, {
    label: "Tiêu đề tin đăng",
    fieldNotFoundCode: "TITLE_FIELD_NOT_FOUND",
    scopeMismatchCode: "TITLE_FIELD_SCOPE_MISMATCH",
    forbiddenLabels: ["Mô tả tin đăng", "Giá bán", "Địa chỉ"],
    editableSelector: "input"
  }).catch(() => "");
  const address = await readFieldDisplayState(page, {
    key: "address",
    label: "Địa chỉ",
    displayName: "địa chỉ"
  });
  return {
    title: {
      populated: titleValue.trim().length > 0,
      value: titleValue.trim()
    },
    requiredFields,
    missingRequiredFields: requiredFields.filter((field) => !field.populated),
    address
  };
}

async function waitForAiSelectedFieldsStable(page, timeoutMs = 15000) {
  console.log("WAITING_FOR_AI_SELECTED_DETAIL_FIELDS");
  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;
  let lastSignature = "";
  let lastState = await inspectAiSelectedFields(page);

  while (Date.now() < deadline) {
    const state = await inspectAiSelectedFields(page);
    const signature = JSON.stringify({
      title: { populated: state.title.populated, value: state.title.value },
      required: state.requiredFields.map((field) => ({ key: field.key, populated: field.populated, value: field.value })),
      address: { populated: state.address.populated, value: state.address.value }
    });
    if (signature === lastSignature) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= 1800) {
        console.log("AI_SELECTED_DETAIL_FIELDS_STABLE", {
          titlePopulated: state.title.populated,
          missingRequiredFields: state.missingRequiredFields.map((field) => field.displayName),
          addressPopulated: state.address.populated
        });
        return state;
      }
    } else {
      stableSince = 0;
      lastSignature = signature;
      lastState = state;
    }
    await page.waitForTimeout(300);
  }

  console.log("AI_SELECTED_DETAIL_FIELDS_WAIT_ENDED", {
    titlePopulated: lastState.title.populated,
    missingRequiredFields: lastState.missingRequiredFields.map((field) => field.displayName),
    addressPopulated: lastState.address.populated
  });
  return lastState;
}

function getManualReviewResult(detailState) {
  if (!detailState.title.populated) {
    return {
      code: "LISTING_NEEDS_TITLE",
      message: "Chợ Tốt chưa tạo tiêu đề. Vui lòng nhập tiêu đề thủ công."
    };
  }
  if (detailState.missingRequiredFields.length > 0) {
    const names = detailState.missingRequiredFields.map((field) => field.displayName).join(", ");
    return {
      code: "LISTING_NEEDS_DETAIL_REVIEW",
      message: `Chợ Tốt chưa tự chọn: ${names}. Vui lòng chọn thủ công trước khi đăng.`
    };
  }
  if (!detailState.address.populated) {
    return {
      code: "LISTING_NEEDS_ADDRESS",
      message: "Tin đăng đã được điền. Vui lòng chọn địa chỉ rồi bấm Đăng tin."
    };
  }
  return {
    code: "LISTING_READY_FOR_MANUAL_REVIEW",
    message: "Đã chuẩn bị xong tin đăng. Vui lòng kiểm tra và bấm Đăng tin."
  };
}

async function getFinalPostButtonState(page) {
  return page.evaluate(() => {
    function normalize(value = "") {
      return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u0111\u0110]/g, "d")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }
    function visible(element) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
    }
    const forbidden = ["luu nhap", "xem truoc"];
    const candidates = [...document.querySelectorAll("button, [role='button']")].filter((element) => {
      if (!visible(element)) return false;
      const text = normalize(element.innerText || element.textContent || element.getAttribute("aria-label") || "");
      return text.includes("dang tin") && !forbidden.some((item) => text.includes(item));
    });
    const button = candidates[0] || null;
    if (!button) return { visible: false, enabled: false };
    const ariaDisabled = normalize(button.getAttribute("aria-disabled") || "");
    const disabled = Boolean(button.disabled) || ariaDisabled === "true" || button.getAttribute("disabled") !== null;
    return {
      visible: true,
      enabled: !disabled,
      text: (button.innerText || button.textContent || "").trim().slice(0, 80)
    };
  }).catch((error) => {
    error.code = error.code || "CHOTOT_TAB_CLOSED_BEFORE_READY";
    throw error;
  });
}

async function verifyEarlyManualReady(page, payload, expectedImageCount) {
  const diagnostics = await getUploadDiagnostics(page);
  const priceDigits = String(Number(payload.price));
  const descriptionValue = await readScopedFieldValue(page, {
    label: "Mô tả tin đăng",
    fieldNotFoundCode: "DESCRIPTION_FIELD_NOT_FOUND",
    scopeMismatchCode: "DESCRIPTION_FIELD_SCOPE_MISMATCH",
    forbiddenLabels: ["Tiêu đề tin đăng", "Giá bán", "Địa chỉ"],
    editableSelector: "textarea"
  }).catch(() => "");
  const titleValue = await readScopedFieldValue(page, {
    label: "Tiêu đề tin đăng",
    fieldNotFoundCode: "TITLE_FIELD_NOT_FOUND",
    scopeMismatchCode: "TITLE_FIELD_SCOPE_MISMATCH",
    forbiddenLabels: ["Mô tả tin đăng", "Giá bán", "Địa chỉ"],
    editableSelector: "input"
  }).catch(() => "");
  const priceValue = await readScopedFieldValue(page, {
    label: "Giá bán",
    fieldNotFoundCode: "PRICE_FIELD_NOT_FOUND",
    scopeMismatchCode: "PRICE_FIELD_SCOPE_MISMATCH",
    forbiddenLabels: ["Mô tả tin đăng", "Tiêu đề tin đăng", "Địa chỉ"],
    requiredText: ["đ"],
    editableSelector: "input"
  }).catch(() => "");
  const finalPostButton = await getFinalPostButtonState(page);
  const checks = {
    imageCountOk: diagnostics.realThumbnailCount === expectedImageCount,
    descriptionOk: descriptionValue.trim() === payload.description.trim(),
    titleOk: titleValue.trim().length > 0,
    priceOk: priceValue.replace(/\D/g, "") === priceDigits,
    finalPostButtonVisible: finalPostButton.visible,
    finalPostButtonEnabled: finalPostButton.enabled
  };
  return {
    ready: Object.values(checks).every(Boolean),
    diagnostics: {
      ...diagnostics,
      finalPostButton
    },
    checks
  };
}

async function verifyPreparedListing(page, payload, expectedImageCount, detailState) {
  const diagnostics = await getUploadDiagnostics(page);
  const text = await pageText(page);
  const priceDigits = String(Number(payload.price));
  const descriptionValue = await readScopedFieldValue(page, {
    label: "Mô tả tin đăng",
    fieldNotFoundCode: "DESCRIPTION_FIELD_NOT_FOUND",
    scopeMismatchCode: "DESCRIPTION_FIELD_SCOPE_MISMATCH",
    forbiddenLabels: ["Tiêu đề tin đăng", "Giá bán", "Địa chỉ"],
    editableSelector: "textarea"
  }).catch(() => "");
  const titleValue = await readScopedFieldValue(page, {
    label: "Tiêu đề tin đăng",
    fieldNotFoundCode: "TITLE_FIELD_NOT_FOUND",
    scopeMismatchCode: "TITLE_FIELD_SCOPE_MISMATCH",
    forbiddenLabels: ["Mô tả tin đăng", "Giá bán", "Địa chỉ"],
    editableSelector: "input"
  }).catch(() => "");
  const priceValue = await readScopedFieldValue(page, {
    label: "Giá bán",
    fieldNotFoundCode: "PRICE_FIELD_NOT_FOUND",
    scopeMismatchCode: "PRICE_FIELD_SCOPE_MISMATCH",
    forbiddenLabels: ["Mô tả tin đăng", "Tiêu đề tin đăng", "Địa chỉ"],
    requiredText: ["đ"],
    editableSelector: "input"
  }).catch(() => "");
  const checks = {
    imageCountOk: diagnostics.realThumbnailCount === expectedImageCount,
    titleOk: titleValue.trim().length > 0,
    descriptionOk: descriptionValue.trim() === payload.description.trim(),
    priceOk: priceValue.replace(/\D/g, "") === priceDigits,
    requiredDetailsPopulated: detailState.missingRequiredFields.length === 0,
    noBlockingValidation:
      !text.includes("vui long dien toi thieu 1.000") &&
      !text.includes("khong hop le") &&
      !text.includes("khong phai dinh dang") &&
      !text.includes("tai len that bai")
  };
  const hardChecks = {
    imageCountOk: checks.imageCountOk,
    descriptionOk: checks.descriptionOk,
    priceOk: checks.priceOk,
    noBlockingValidation: checks.noBlockingValidation
  };
  if (!Object.values(hardChecks).every(Boolean)) {
    const error = new Error("FORM_VERIFICATION_FAILED");
    error.code = "FORM_VERIFICATION_FAILED";
    error.detail = {
      expectedImageCount,
      actualImageCount: diagnostics.realThumbnailCount,
      missingRequiredFields: detailState.missingRequiredFields.map((field) => field.displayName),
      addressPopulated: detailState.address.populated,
      ...checks
    };
    throw error;
  }
  return { diagnostics, checks };
}

function emitProgress(context, code, detail = null) {
  if (typeof context.onProgress === "function") context.onProgress(code, detail);
}

async function prepareListing(page, payload, filePaths, context = {}) {
  const totalStartedAt = Date.now();
  await ensurePostingFormReady(page);
  emitProgress(context, "UPLOADING_IMAGES");
  const uploadResult = await uploadImages(page, filePaths, filePaths.length, context);
  if (!uploadResult.ready) {
    emitProgress(context, uploadResult.code, uploadResult.diagnostics);
    return {
      code: uploadResult.code,
      message: uploadResult.message,
      diagnostics: uploadResult.diagnostics,
      uploadDiagnostics: uploadResult.diagnostics,
      imagePreparation: context.imagePreparation || []
    };
  }
  emitProgress(context, "ALL_IMAGES_UPLOADED");
  emitProgress(context, "FILLING_DESCRIPTION");
  const descriptionStartedAt = Date.now();
  const descriptionConfirmed = await fillDescription(page, payload.description.trim());
  const descriptionAcceptedMs = Date.now() - descriptionStartedAt;
  emitProgress(context, "DESCRIPTION_FILLED");
  let aiRenderWaitMs = 0;
  let priceFillVerifyMs = 0;
  if (descriptionConfirmed) {
    const firstPriceStartedAt = Date.now();
    await fillPriceWithFastRetry(page, payload, context);
    priceFillVerifyMs += Date.now() - firstPriceStartedAt;
    const aiStartedAt = Date.now();
    await waitForChoTotAiRender(page);
    aiRenderWaitMs = Date.now() - aiStartedAt;
    console.log("AI_RENDER_WAIT_MS", aiRenderWaitMs);
  } else {
    await waitForRemainingFields(page);
    console.log("RELOCATING_ALL_FIELDS");
  }
  emitProgress(context, "REMAINING_FIELDS_READY");
  await ensureDescriptionMatchesPayload(page, payload);
  const priceStartedAt = Date.now();
  await fillPriceWithFastRetry(page, payload, context);
  priceFillVerifyMs += Date.now() - priceStartedAt;
  console.log("PRICE_FILL_VERIFY_MS", priceFillVerifyMs);
  const earlyReadyStartedAt = Date.now();
  const earlyReady = await verifyEarlyManualReady(page, payload, filePaths.length);
  console.log("FINAL_POST_BUTTON_READY_MS", Date.now() - earlyReadyStartedAt, {
    finalPostButtonVisible: earlyReady.checks.finalPostButtonVisible,
    finalPostButtonEnabled: earlyReady.checks.finalPostButtonEnabled
  });
  if (earlyReady.ready) {
    const totalRequestMs = Date.now() - totalStartedAt;
    console.log("LISTING_READY_FOR_MANUAL_POST", {
      earlyReadyMs: totalRequestMs,
      timeImagesReadyMs: uploadResult.diagnostics?.verificationElapsedMs || null,
      timeDescriptionAcceptedMs: descriptionAcceptedMs,
      timePriceConfirmedMs: priceFillVerifyMs,
      timeFinalPostButtonEnabledMs: Date.now() - earlyReadyStartedAt
    });
    emitProgress(context, "LISTING_READY_FOR_MANUAL_POST", earlyReady.checks);
    return {
      code: "LISTING_READY_FOR_MANUAL_POST",
      message: "Tin đăng đã sẵn sàng. Bạn có thể kiểm tra và bấm Đăng tin.",
      diagnostics: earlyReady.diagnostics,
      checks: earlyReady.checks,
      timings: {
        aiRenderWaitMs,
        descriptionAcceptedMs,
        priceFieldDetectionAndFillMs: priceFillVerifyMs,
        earlyReadyMs: totalRequestMs,
        totalRequestMs
      },
      uploadDiagnostics: uploadResult.diagnostics,
      imagePreparation: context.imagePreparation || []
    };
  }

  emitProgress(context, "CHECKING_AI_DETAIL_FIELDS");
  const reviewStartedAt = Date.now();
  const detailState = await waitForAiSelectedFieldsStable(page);
  const remainingReviewMs = Date.now() - reviewStartedAt;
  console.log("REMAINING_REVIEW_MS", remainingReviewMs);
  const reviewResult = getManualReviewResult(detailState);
  const verification = await verifyPreparedListing(page, payload, filePaths.length, detailState);
  console.log("TOTAL_REQUEST_MS", Date.now() - totalStartedAt);
  emitProgress(context, reviewResult.code);
  return {
    code: reviewResult.code,
    message: reviewResult.message,
    diagnostics: verification.diagnostics,
    checks: verification.checks,
    detailState,
    timings: {
      aiRenderWaitMs,
      descriptionAcceptedMs,
      priceFieldDetectionAndFillMs: priceFillVerifyMs,
      remainingReviewMs,
      totalRequestMs: Date.now() - totalStartedAt
    },
    uploadDiagnostics: uploadResult.diagnostics,
    imagePreparation: context.imagePreparation || []
  };
}

module.exports = {
  prepareListing,
  uploadOneImage
};
