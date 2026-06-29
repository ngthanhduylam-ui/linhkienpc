(function initChoTotFill() {
  const C = window.PHUOC_TAI_CHO_TOT;
  const STEP_DELAY_MS = 250;
  const WAIT_TIMEOUT_MS = 12000;
  const MANUAL_IMAGE_TIMEOUT_MS = 180000;
  const REMAINING_FIELDS_TIMEOUT_MS = 90000;
  const CHOTOT_MINIMUM_PRICE = 1000;
  const flowState = window.__PHUOC_TAI_CHO_TOT_FLOW_STATE__ || {
    activeRequestId: "",
    activeRunId: 0,
    contextInvalidated: false
  };
  window.__PHUOC_TAI_CHO_TOT_FLOW_STATE__ = flowState;

  const labelMaps = {
    condition: {
      new: ["moi", "new"],
      used_not_repaired: ["da su dung chua sua chua", "chua sua chua"],
      used_repaired: ["da su dung qua sua chua", "qua sua chua"]
    },
    componentType: {
      computer_component: ["linh kien may tinh", "linh kien"]
    },
    deviceType: {
      mainboard: ["bo mach chu mainboard", "mainboard"],
      cpu: ["bo vi xu ly cpu", "cpu"],
      vga: ["card man hinh vga", "vga"],
      psu: ["nguon may tinh psu", "psu"],
      hdd: ["o cung hdd", "hdd"],
      ssd: ["o cung ssd", "ssd"]
    }
  };

  function log(code, details = {}) {
    console.log(C.LOG_PREFIX, code, details);
  }

  function isCurrentFlow(requestId, runId) {
    return !flowState.contextInvalidated && flowState.activeRequestId === requestId && flowState.activeRunId === runId;
  }

  function markContextInvalidated(reason) {
    flowState.contextInvalidated = true;
    flowState.activeRequestId = "";
    log("EXTENSION_CONTEXT_INVALIDATED", { reason });
  }

  function isRuntimeAvailable() {
    try {
      return Boolean(chrome?.runtime?.id && chrome.runtime.sendMessage);
    } catch {
      return false;
    }
  }

  function safeSendRuntimeMessage(message, callback) {
    if (!isRuntimeAvailable()) {
      markContextInvalidated("runtime unavailable");
      callback?.({ ok: false, error: "EXTENSION_CONTEXT_INVALIDATED" });
      return false;
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        let lastError = null;
        try {
          lastError = chrome.runtime.lastError;
        } catch {
          lastError = { message: "Extension context invalidated." };
        }

        if (lastError) {
          const invalidated = /context invalidated|extension context/i.test(lastError.message || "");
          if (invalidated) markContextInvalidated(lastError.message || "runtime lastError");
          callback?.({
            ok: false,
            error: invalidated ? "EXTENSION_CONTEXT_INVALIDATED" : "EXTENSION_COMMUNICATION_FAILED",
            message: lastError.message || ""
          });
          return;
        }

        callback?.(response || { ok: false, error: "EXTENSION_COMMUNICATION_FAILED" });
      });
      return true;
    } catch (error) {
      markContextInvalidated(error?.message || "sendMessage threw");
      callback?.({ ok: false, error: "EXTENSION_CONTEXT_INVALIDATED" });
      return false;
    }
  }

  function sendProgress(requestId, code, message = code, runId = flowState.activeRunId) {
    if (runId && !isCurrentFlow(requestId, runId)) {
      log("STALE_PROGRESS_IGNORED", { requestId, code, runId });
      return;
    }
    log(code, { requestId });
    safeSendRuntimeMessage({
      type: C.RUNTIME_FILL_PROGRESS,
      progress: { requestId, code, message }
    }, () => {});
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  async function waitFor(stepCode, predicate, errorCode, timeout = WAIT_TIMEOUT_MS) {
    log(`${stepCode}_WAIT_START`, { timeout });
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const value = predicate();
      if (value) {
        log(`${stepCode}_WAIT_DONE`);
        return value;
      }
      await sleep(STEP_DELAY_MS);
    }
    log(`${stepCode}_WAIT_TIMEOUT`, { errorCode });
    throw new Error(errorCode);
  }

  function isPostingPage() {
    return location.hostname.endsWith("chotot.com") && /dang|post|listing|sell/i.test(location.pathname);
  }

  function pageText() {
    return normalizeText(document.body?.innerText || "");
  }

  function hasLoginPrompt() {
    const text = pageText();
    return text.includes("dang nhap") || text.includes("login");
  }

  function hasCaptchaOrPayment() {
    const text = pageText();
    if (text.includes("captcha") || text.includes("xac minh")) return "CAPTCHA_OR_VERIFICATION_REQUIRED";
    if (text.includes("thanh toan") || text.includes("payment")) return "PAYMENT_REQUIRED";
    return "";
  }

  function isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function findButtonLikeByText(text) {
    const target = normalizeText(text);
    const nodes = [...document.querySelectorAll("button, [role='button'], li, div, span, label")].filter(isElementVisible);
    return nodes.find((node) => normalizeText(node.innerText || node.textContent) === target);
  }

  function findButtonLikeContaining(text) {
    const target = normalizeText(text);
    const nodes = [...document.querySelectorAll("button, [role='button'], li, div, span, label")].filter(isElementVisible);
    return nodes.find((node) => normalizeText(node.innerText || node.textContent).includes(target));
  }

  function detectOpenPostingForm() {
    const text = pageText();
    const hasMediaSection = text.includes("hinh anh/video") || text.includes("hinh anh");
    const hasDescription = text.includes("mo ta tin dang") || text.includes("mo ta");
    const hasSubmit = Boolean(findButtonLikeContaining("dang tin"));
    const hasDetails = text.includes("thong tin chi tiet");
    return (hasMediaSection && hasDescription) || (hasDescription && hasSubmit) || (hasMediaSection && hasSubmit) || hasDetails;
  }

  function getLabelTextForField(field) {
    const id = field.getAttribute("id");
    const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    return label?.innerText || field.closest("label")?.innerText || "";
  }

  function getNearbyText(element) {
    const parts = [];
    let current = element;
    for (let depth = 0; current && depth < 4; depth += 1) {
      parts.push(current.innerText || current.textContent || "");
      current = current.parentElement;
    }
    return parts.join(" ");
  }

  function findFieldByHints(hints, selector = "input, textarea, [contenteditable='true']") {
    const normalizedHints = hints.map(normalizeText);
    const fields = [...document.querySelectorAll(selector)].filter(isElementVisible);
    return fields.find((field) => {
      const attrs = [
        field.getAttribute("name"),
        field.getAttribute("placeholder"),
        field.getAttribute("aria-label"),
        field.getAttribute("data-testid"),
        field.id,
        getLabelTextForField(field),
        getNearbyText(field)
      ].map(normalizeText).join(" ");
      return normalizedHints.some((hint) => attrs.includes(hint));
    });
  }

  function isEditableTextInput(input) {
    if (!(input instanceof HTMLInputElement) || !isElementVisible(input)) return false;
    const type = normalizeText(input.getAttribute("type") || "text");
    return !["button", "checkbox", "file", "hidden", "image", "radio", "reset", "submit"].includes(type);
  }

  function findInputNearLabel(labelHints, predicate = () => true) {
    const container = findContainerByLabel(labelHints);
    if (!container) return null;
    return [...container.querySelectorAll("input")]
      .filter(isEditableTextInput)
      .find(predicate) || null;
  }

  function hasPriceMinimumValidation() {
    const text = pageText();
    return text.includes("vui long dien toi thieu 1.000") || text.includes("toi thieu 1.000");
  }

  function findPriceField() {
    const byLabel = findInputNearLabel(["gia ban", "gia"], (input) => {
      const nearby = normalizeText(getNearbyText(input));
      const inputMode = normalizeText(input.getAttribute("inputmode"));
      const type = normalizeText(input.getAttribute("type") || "text");
      return (
        inputMode === "numeric" ||
        inputMode === "decimal" ||
        type === "text" ||
        nearby.includes("gia ban") ||
        nearby.includes(" d") ||
        nearby.endsWith("d")
      );
    });
    if (byLabel) return byLabel;

    const candidates = [...document.querySelectorAll("input")]
      .filter(isEditableTextInput)
      .map((input) => {
        const nearby = normalizeText(getNearbyText(input));
        const attrs = [
          input.getAttribute("name"),
          input.getAttribute("placeholder"),
          input.getAttribute("aria-label"),
          input.getAttribute("data-testid"),
          input.id,
          getLabelTextForField(input),
          nearby
        ].map(normalizeText).join(" ");
        let score = 0;
        if (attrs.includes("gia ban")) score += 5;
        if (attrs.includes("gia")) score += 3;
        if (attrs.includes("price")) score += 3;
        if (["numeric", "decimal"].includes(normalizeText(input.getAttribute("inputmode")))) score += 4;
        if (nearby.includes(" d") || nearby.endsWith("d")) score += 2;
        if (hasPriceMinimumValidation() && nearby.includes("toi thieu 1.000")) score += 4;
        return { input, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.input || null;
  }

  function cleanLabelText(value) {
    return normalizeText(value).replace(/\*/g, "").replace(/\s+/g, " ").trim();
  }

  function labelStartsWith(node, expectedLabel) {
    const text = cleanLabelText(node.innerText || node.textContent);
    const expected = cleanLabelText(expectedLabel);
    return text === expected || text.startsWith(`${expected} `);
  }

  function findStrictLabel(expectedLabel) {
    return [...document.querySelectorAll("label, div, span, p")]
      .filter(isElementVisible)
      .find((node) => labelStartsWith(node, expectedLabel));
  }

  function getEditableInputsInside(container) {
    return [...container.querySelectorAll("input")].filter(isEditableTextInput);
  }

  function getScopedFieldByLabel({
    expectedLabel,
    rejectLabels = [],
    requirePriceSignal = false,
    fieldErrorCode,
    scopeErrorCode
  }) {
    const label = findStrictLabel(expectedLabel);
    if (!label) return { error: fieldErrorCode, label: null, container: null, input: null };

    let current = label;
    const expected = cleanLabelText(expectedLabel);
    const rejected = rejectLabels.map(cleanLabelText);
    for (let depth = 0; current && depth < 7; depth += 1) {
      const inputs = getEditableInputsInside(current);
      const text = cleanLabelText(current.innerText || current.textContent);
      const hasExpectedLabel = text.includes(expected);
      const hasRejectedLabel = rejected.some((item) => text.includes(item));
      const rawText = current.innerText || current.textContent || "";
      const hasPriceSignal = !requirePriceSignal || /đ|₫/i.test(rawText) || text.includes("toi thieu 1.000");

      if (inputs.length > 0 && hasExpectedLabel) {
        if (hasRejectedLabel || !hasPriceSignal) {
          return { error: scopeErrorCode, label, container: current, input: null };
        }
        return { error: "", label, container: current, input: inputs[0] };
      }
      current = current.parentElement;
    }

    return { error: fieldErrorCode, label, container: null, input: null };
  }

  function logFieldIdentity(code, label, container, input) {
    log(code, {
      fieldLabel: cleanLabelText(label?.innerText || label?.textContent || ""),
      tagName: input?.tagName || "",
      inputType: input?.getAttribute?.("type") || "",
      inputMode: input?.getAttribute?.("inputmode") || "",
      placeholder: input?.getAttribute?.("placeholder") || "",
      ariaLabel: input?.getAttribute?.("aria-label") || "",
      nearbyLabelText: cleanLabelText(container?.innerText || container?.textContent || "").slice(0, 160)
    });
  }

  function assertFieldMatchesExpectedLabel(element, expectedLabel, scopeErrorCode) {
    const scoped = cleanLabelText(expectedLabel) === "gia ban"
      ? findScopedPriceField()
      : findScopedTitleField();
    if (!scoped.input || scoped.input !== element) throw new Error(scopeErrorCode);
    return scoped;
  }

  function findScopedTitleField() {
    return getScopedFieldByLabel({
      expectedLabel: "tieu de tin dang",
      fieldErrorCode: "TITLE_FIELD_NOT_FOUND",
      scopeErrorCode: "TITLE_FIELD_SCOPE_MISMATCH"
    });
  }

  function findScopedPriceField() {
    return getScopedFieldByLabel({
      expectedLabel: "gia ban",
      rejectLabels: ["tieu de tin dang", "dia chi", "mo ta tin dang", "hinh anh"],
      requirePriceSignal: true,
      fieldErrorCode: "PRICE_FIELD_NOT_FOUND",
      scopeErrorCode: "PRICE_FIELD_SCOPE_MISMATCH"
    });
  }

  function findTextNodeElement(text) {
    const target = normalizeText(text);
    return [...document.querySelectorAll("label, div, span, p, h1, h2, h3")]
      .filter(isElementVisible)
      .find((node) => normalizeText(node.innerText || node.textContent).includes(target));
  }

  function findEditableNearText(text) {
    const labelNode = findTextNodeElement(text);
    if (!labelNode) return null;
    let current = labelNode;
    for (let depth = 0; current && depth < 5; depth += 1) {
      const field = current.querySelector?.("textarea, input, [contenteditable='true']");
      if (isElementVisible(field)) return field;
      current = current.parentElement;
    }
    return null;
  }

  function textMatchesAny(value, hints) {
    const normalizedValue = normalizeText(value);
    return hints.map(normalizeText).some((hint) => normalizedValue.includes(hint));
  }

  function findContainerByLabel(labelHints) {
    const hints = Array.isArray(labelHints) ? labelHints : [labelHints];
    const labelNode = [...document.querySelectorAll("label, div, span, p, h1, h2, h3")]
      .filter(isElementVisible)
      .find((node) => textMatchesAny(node.innerText || node.textContent, hints));
    if (!labelNode) return null;
    let current = labelNode;
    for (let depth = 0; current && depth < 5; depth += 1) {
      const text = normalizeText(current.innerText || current.textContent);
      const hasControl = current.querySelector?.("button, [role='button'], [role='combobox'], input, select");
      if (hints.some((hint) => text.includes(normalizeText(hint))) && hasControl) return current;
      current = current.parentElement;
    }
    return labelNode;
  }

  function findDropdownFieldByLabel(labelHints) {
    const container = findContainerByLabel(labelHints);
    if (!container) return null;
    const controls = [
      ...container.querySelectorAll("button, [role='button'], [role='combobox'], input, select, div, span")
    ].filter((node) => {
      if (!isElementVisible(node)) return false;
      const text = normalizeText(node.innerText || node.textContent || node.getAttribute("aria-label") || node.getAttribute("placeholder") || "");
      if (text.includes("ai viet giup") || text.includes("ai sua giup") || text.includes("dang tin")) return false;
      return node !== container;
    });
    return controls.find((node) => {
      const text = normalizeText(node.innerText || node.textContent || node.getAttribute("aria-label") || node.getAttribute("placeholder") || "");
      return text && !textMatchesAny(text, labelHints);
    }) || controls[0] || container;
  }

  function fieldOrNearbyTextContains(field, optionHints) {
    if (!field) return false;
    return textMatchesAny(getNearbyText(field), optionHints) || textMatchesAny(field.innerText || field.textContent || field.value, optionHints);
  }

  function isForbiddenActionElement(element) {
    const text = normalizeText(element?.innerText || element?.textContent || element?.getAttribute?.("aria-label") || "");
    return (
      text.includes("dang tin") ||
      text.includes("luu nhap") ||
      text.includes("xem truoc") ||
      text.includes("thanh toan") ||
      text.includes("captcha") ||
      text.includes("xac minh") ||
      text.includes("verification") ||
      text.includes("payment")
    );
  }

  function safeClick(element, actionName) {
    if (isForbiddenActionElement(element)) {
      log("FORBIDDEN_ACTION_BLOCKED", { actionName, text: normalizeText(element?.innerText || element?.textContent || "").slice(0, 80) });
      throw new Error("FORBIDDEN_ACTION_BLOCKED");
    }
    element.click();
  }

  function dispatchInput(element, value, { blur = true } = {}) {
    element.scrollIntoView?.({ block: "center", inline: "nearest" });
    element.focus?.();
    element.select?.();
    if (element.isContentEditable) {
      element.textContent = value;
    } else {
      const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      if (descriptor?.set) {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
    }
    if (typeof InputEvent === "function") {
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    } else {
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
    element.dispatchEvent(new Event("change", { bubbles: true }));
    if (blur) {
      element.blur?.();
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    }
  }

  function readFieldValue(element) {
    return element.isContentEditable ? element.textContent || "" : element.value || "";
  }

  function controlledFieldValueMatches(currentValue, expectedValue) {
    return normalizeText(currentValue) === normalizeText(expectedValue);
  }

  async function fillControlledField({
    requestId,
    runId,
    fieldName,
    locateField,
    value,
    errorCode,
    verifyValue = controlledFieldValueMatches,
    retries = 3,
    verifyDelayMs = 700,
    findStartCode = "",
    foundCode = "",
    fillStartCode = "",
    filledCode = "",
    findStartMessage = "",
    foundMessage = "",
    fillStartMessage = "",
    filledMessage = ""
  }) {
    const expectedValue = String(value || "");
    if (findStartCode) sendProgress(requestId, findStartCode, findStartMessage || findStartCode, runId);
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      if (!isCurrentFlow(requestId, runId)) throw new Error("STALE_FILL_FLOW");
      log("CONTROLLED_FIELD_FILL_ATTEMPT", { requestId, fieldName, attempt });
      const field = attempt === 1
        ? await waitFor(`STEP_${fieldName}_FIND`, locateField, `${fieldName}_FIELD_NOT_FOUND`, REMAINING_FIELDS_TIMEOUT_MS)
        : locateField();
      if (!field) {
        log("CONTROLLED_FIELD_VERIFY_FAILED", { requestId, fieldName, attempt, reason: "FIELD_REPLACED_OR_MISSING" });
        await sleep(STEP_DELAY_MS);
        continue;
      }

      if (attempt === 1 && foundCode) sendProgress(requestId, foundCode, foundMessage || foundCode, runId);
      if (fillStartCode) sendProgress(requestId, fillStartCode, fillStartMessage || fillStartCode, runId);
      dispatchInput(field, expectedValue);
      log("CONTROLLED_FIELD_VALUE_SET", { requestId, fieldName, attempt, length: expectedValue.length });
      log("CONTROLLED_FIELD_VERIFY_START", { requestId, fieldName, attempt, delayMs: verifyDelayMs });
      await sleep(verifyDelayMs);

      const currentField = locateField() || field;
      const currentValue = readFieldValue(currentField);
      if (verifyValue(currentValue, expectedValue, currentField)) {
        log("CONTROLLED_FIELD_VERIFY_SUCCESS", { requestId, fieldName, attempt, length: currentValue.length });
        if (filledCode) sendProgress(requestId, filledCode, filledMessage || filledCode, runId);
        return currentField;
      }

      log("CONTROLLED_FIELD_VERIFY_FAILED", {
        requestId,
        fieldName,
        attempt,
        currentLength: currentValue.length,
        expectedLength: expectedValue.length
      });
      await sleep(200);
    }

    log(errorCode, { requestId, fieldName });
    throw new Error(errorCode);
  }

  async function clickOption(requestId, hints, errorCode, runId) {
    const hintList = Array.isArray(hints) ? hints : [hints];
    log("STEP_CLICK_OPTION_START", { requestId, hints: hintList });
    const option = await waitFor(
      `STEP_CLICK_OPTION_${errorCode}`,
      () => hintList.map(normalizeText).map((hint) => findButtonLikeByText(hint) || findButtonLikeContaining(hint)).find(Boolean),
      errorCode
    );
    if (!isCurrentFlow(requestId, runId)) throw new Error("STALE_FILL_FLOW");
    safeClick(option, "category_or_option");
    await sleep(500);
    log("STEP_CLICK_OPTION_DONE", { requestId, hints: hintList });
  }

  async function fillDropdownByLabel({
    requestId,
    runId,
    fieldCode,
    labelHints,
    optionHints,
    fieldErrorCode,
    optionErrorCode
  }) {
    const field = await waitFor(
      `STEP_${fieldCode}_FIELD`,
      () => findDropdownFieldByLabel(labelHints),
      fieldErrorCode,
      REMAINING_FIELDS_TIMEOUT_MS
    );
    if (!isCurrentFlow(requestId, runId)) throw new Error("STALE_FILL_FLOW");
    field.scrollIntoView?.({ block: "center", inline: "nearest" });
    if (field instanceof HTMLSelectElement) {
      const option = [...field.options].find((item) => textMatchesAny(item.textContent, optionHints));
      if (!option) throw new Error(optionErrorCode);
      field.value = option.value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(700);
      if (!fieldOrNearbyTextContains(field, optionHints)) throw new Error(optionErrorCode);
      return;
    }
    safeClick(field, "dropdown_field");
    await sleep(300);

    const option = await waitFor(
      `STEP_${fieldCode}_OPTION`,
      () => {
        const optionNodes = [...document.querySelectorAll("button, [role='button'], [role='option'], li, div, span")]
          .filter(isElementVisible)
          .filter((node) => {
            const text = normalizeText(node.innerText || node.textContent);
            if (!text || text.includes("ai viet giup") || text.includes("ai sua giup") || text.includes("dang tin")) return false;
            return textMatchesAny(text, optionHints);
          });
        return optionNodes.find((node) => textMatchesAny(node.innerText || node.textContent, optionHints));
      },
      optionErrorCode,
      WAIT_TIMEOUT_MS
    );
    if (!isCurrentFlow(requestId, runId)) throw new Error("STALE_FILL_FLOW");
    safeClick(option, "dropdown_option");
    await sleep(700);

    const selectedField = findDropdownFieldByLabel(labelHints) || field;
    if (!fieldOrNearbyTextContains(selectedField, optionHints) && !pageText().includes(normalizeText(optionHints[0]))) {
      throw new Error(optionErrorCode);
    }
  }

  async function ensureCategoryIfNeeded(requestId, runId) {
    sendProgress(requestId, "STEP_DETECT_PAGE_START", "STEP_DETECT_PAGE_START", runId);
    if (!isPostingPage()) throw new Error("UNSUPPORTED_PAGE");
    if (hasLoginPrompt()) throw new Error("LOGIN_REQUIRED");
    const blocker = hasCaptchaOrPayment();
    if (blocker) throw new Error(blocker);

    if (detectOpenPostingForm()) {
      sendProgress(requestId, "FORM_ALREADY_OPEN", "Da nhan dien form dang tin Cho Tot.", runId);
      sendProgress(requestId, "CATEGORY_STEP_SKIPPED", "Da bo qua buoc chon danh muc vi form dang tin dang mo.", runId);
      return;
    }

    const formAlreadyOpen = await waitFor(
      "STEP_DETECT_PAGE",
      detectOpenPostingForm,
      "FORM_DETECTION_TIMEOUT",
      5000
    ).catch(() => false);

    if (formAlreadyOpen) {
      sendProgress(requestId, "FORM_ALREADY_OPEN", "Da nhan dien form dang tin Cho Tot.", runId);
      sendProgress(requestId, "CATEGORY_STEP_SKIPPED", "Da bo qua buoc chon danh muc vi form dang tin dang mo.", runId);
      return;
    }

    sendProgress(requestId, "STEP_CATEGORY_START", "STEP_CATEGORY_START", runId);
    await clickOption(requestId, ["do dien tu", "dien tu"], "CATEGORY_NOT_FOUND", runId);
    await clickOption(requestId, ["linh kien ram card", "linh kien"], "CATEGORY_NOT_FOUND", runId);
    sendProgress(requestId, "STEP_CATEGORY_DONE", "STEP_CATEGORY_DONE", runId);
  }

  async function fillDescription(requestId, description, runId) {
    sendProgress(requestId, "STEP_DESCRIPTION_FIND_START", "STEP_DESCRIPTION_FIND_START", runId);
    const locateDescriptionField = () => (
      findFieldByHints(["mo ta tin dang", "mo ta", "description", "noi dung tin"], "textarea, input, [contenteditable='true']") ||
      findEditableNearText("mo ta tin dang") ||
      findEditableNearText("mo ta")
    );
    const field = await waitFor("STEP_DESCRIPTION_FIND", locateDescriptionField, "DESCRIPTION_FIELD_NOT_FOUND");
    sendProgress(requestId, "STEP_DESCRIPTION_FOUND", "STEP_DESCRIPTION_FOUND", runId);
    if (!field || !isCurrentFlow(requestId, runId)) throw new Error("STALE_FILL_FLOW");
    await fillControlledField({
      requestId,
      runId,
      fieldName: "DESCRIPTION",
      locateField: locateDescriptionField,
      value: description.slice(0, C.MAX_DESCRIPTION_LENGTH),
      errorCode: "DESCRIPTION_STATE_NOT_PERSISTED"
    });
    sendProgress(requestId, "DESCRIPTION_FILLED", "Mo ta da duoc dien tren Cho Tot.", runId);
  }

  function hasTitleFieldVisible() {
    return Boolean(
      findFieldByHints(["tieu de", "title"], "input, textarea, [contenteditable='true']") ||
      findEditableNearText("tieu de")
    );
  }

  function hasDetailFieldsUnlocked() {
    const text = pageText();
    return text.includes("thong tin chi tiet") && hasTitleFieldVisible();
  }

  function hasUploadedImage() {
    const text = pageText();
    const fileInputs = [...document.querySelectorAll("input[type='file']")];
    if (fileInputs.some((input) => input.files?.length > 0)) return true;
    if (hasDetailFieldsUnlocked()) return true;
    const imageThumbs = [...document.querySelectorAll("img")].filter((image) => {
      const src = image.currentSrc || image.src || "";
      const rect = image.getBoundingClientRect();
      const nearby = normalizeText(getNearbyText(image));
      return rect.width >= 40 && rect.height >= 40 && !/logo|avatar|icon|ai/i.test(src) && nearby.includes("hinh anh");
    });
    return imageThumbs.length > 0 || text.includes("anh da tai");
  }

  async function waitForManualImage(requestId, runId) {
    if (hasUploadedImage()) {
      sendProgress(requestId, "IMAGE_DETECTED", "Da nhan dien anh tren form Cho Tot.", runId);
      return;
    }
    sendProgress(
      requestId,
      "WAITING_FOR_MANUAL_IMAGE",
      "Mô tả đã được điền. Vui lòng thêm ít nhất một ảnh trên Chợ Tốt, tiện ích sẽ tiếp tục tự động.",
      runId
    );
    await waitFor("STEP_MANUAL_IMAGE", hasUploadedImage, "MANUAL_IMAGE_TIMEOUT", MANUAL_IMAGE_TIMEOUT_MS);
    sendProgress(requestId, "IMAGE_DETECTED", "Da nhan dien anh tren form Cho Tot.", runId);
  }

  async function fillTitle(requestId, runId, title) {
    await fillControlledField({
      requestId,
      runId,
      fieldName: "TITLE",
      locateField: () => findFieldByHints(["tieu de", "title"], "input, textarea, [contenteditable='true']") || findEditableNearText("tieu de"),
      value: title,
      errorCode: "TITLE_STATE_NOT_PERSISTED",
      findStartCode: "STEP_TITLE_FIND_START",
      foundCode: "STEP_TITLE_FOUND",
      fillStartCode: "STEP_TITLE_FILL_START",
      filledCode: "STEP_TITLE_FILLED",
      findStartMessage: "Đang tìm ô tiêu đề...",
      foundMessage: "Đã tìm thấy ô tiêu đề.",
      fillStartMessage: "Đang điền tiêu đề...",
      filledMessage: "Đã điền tiêu đề."
    });
  }

  async function fillPrice(requestId, runId, price) {
    await fillControlledField({
      requestId,
      runId,
      fieldName: "PRICE",
      locateField: () => findFieldByHints(["gia", "price"], "input") || findEditableNearText("gia"),
      value: String(price),
      errorCode: "PRICE_STATE_NOT_PERSISTED",
      verifyValue: (currentValue, expectedValue) => currentValue.replace(/\D/g, "") === expectedValue.replace(/\D/g, ""),
      findStartCode: "STEP_PRICE_FIND_START",
      foundCode: "STEP_PRICE_FOUND",
      fillStartCode: "STEP_PRICE_FILL_START",
      filledCode: "STEP_PRICE_FILLED",
      findStartMessage: "Đang tìm ô giá...",
      foundMessage: "Đã tìm thấy ô giá.",
      fillStartMessage: "Đang điền giá...",
      filledMessage: "Đã điền giá."
    });
  }

  async function fillScopedTitle(requestId, runId, title) {
    sendProgress(requestId, "STEP_TITLE_FIND_START", "Dang tim o tieu de...", runId);
    const scoped = await waitFor(
      "STEP_TITLE_FIND",
      () => {
        const result = findScopedTitleField();
        if (result.error === "TITLE_FIELD_SCOPE_MISMATCH") throw new Error(result.error);
        return result.input ? result : null;
      },
      "TITLE_FIELD_NOT_FOUND",
      REMAINING_FIELDS_TIMEOUT_MS
    );
    logFieldIdentity("TITLE_INPUT_FOUND", scoped.label, scoped.container, scoped.input);
    assertFieldMatchesExpectedLabel(scoped.input, "tieu de tin dang", "TITLE_FIELD_SCOPE_MISMATCH");
    sendProgress(requestId, "STEP_TITLE_FOUND", "Da tim thay o tieu de.", runId);
    await fillControlledField({
      requestId,
      runId,
      fieldName: "TITLE",
      locateField: () => {
        const result = findScopedTitleField();
        if (result.error === "TITLE_FIELD_SCOPE_MISMATCH") throw new Error(result.error);
        return result.input;
      },
      value: title,
      errorCode: "TITLE_STATE_NOT_PERSISTED",
      fillStartCode: "STEP_TITLE_FILL_START",
      filledCode: "STEP_TITLE_FILLED",
      fillStartMessage: "Dang dien tieu de...",
      filledMessage: "Da dien tieu de."
    });
  }

  async function ensureTitleCorrectBeforePrice(requestId, runId, expectedTitle, expectedPriceDigits) {
    sendProgress(requestId, "STEP_TITLE_VERIFY_START", "Dang kiem tra lai tieu de...", runId);
    const scoped = findScopedTitleField();
    if (scoped.error || !scoped.input) throw new Error(scoped.error || "TITLE_FIELD_NOT_FOUND");
    logFieldIdentity("TITLE_VERIFY_FIELD", scoped.label, scoped.container, scoped.input);
    assertFieldMatchesExpectedLabel(scoped.input, "tieu de tin dang", "TITLE_FIELD_SCOPE_MISMATCH");

    const currentValue = readFieldValue(scoped.input);
    if (normalizeText(currentValue) === normalizeText(expectedTitle)) {
      sendProgress(requestId, "TITLE_VALUE_CORRECT", "Tieu de dang dung.", runId);
      return;
    }

    if (currentValue.replace(/\D/g, "") === expectedPriceDigits || normalizeText(currentValue) !== normalizeText(expectedTitle)) {
      await fillControlledField({
        requestId,
        runId,
        fieldName: "TITLE_RESTORE",
        locateField: () => {
          const result = findScopedTitleField();
          if (result.error === "TITLE_FIELD_SCOPE_MISMATCH") throw new Error(result.error);
          return result.input;
        },
        value: expectedTitle,
        errorCode: "TITLE_STATE_NOT_PERSISTED",
        fillStartCode: "STEP_TITLE_FILL_START",
        filledCode: "TITLE_RESTORED",
        fillStartMessage: "Dang khoi phuc tieu de...",
        filledMessage: "Da khoi phuc tieu de."
      });
      return;
    }

    throw new Error("TITLE_STATE_NOT_PERSISTED");
  }

  async function fillChototPrice(requestId, runId, price, expectedTitle) {
    const numericPrice = Number(price);
    if (!Number.isSafeInteger(numericPrice) || numericPrice < CHOTOT_MINIMUM_PRICE) {
      throw new Error("PRICE_BELOW_CHOTOT_MINIMUM");
    }

    const expectedDigits = String(numericPrice);
    await ensureTitleCorrectBeforePrice(requestId, runId, expectedTitle, expectedDigits);
    sendProgress(requestId, "STEP_PRICE_FIND_START", "Dang tim o gia...", runId);
    const firstScoped = await waitFor(
      "STEP_PRICE_FIND",
      () => {
        const result = findScopedPriceField();
        if (result.error === "PRICE_FIELD_SCOPE_MISMATCH") throw new Error(result.error);
        return result.input ? result : null;
      },
      "PRICE_FIELD_NOT_FOUND",
      REMAINING_FIELDS_TIMEOUT_MS
    );
    if (!firstScoped?.input || !isCurrentFlow(requestId, runId)) throw new Error("STALE_FILL_FLOW");
    sendProgress(requestId, "PRICE_LABEL_FOUND", "Da tim thay nhan gia ban.", runId);
    sendProgress(requestId, "PRICE_CONTAINER_FOUND", "Da tim thay vung gia ban.", runId);
    sendProgress(requestId, "PRICE_INPUT_FOUND", "Da tim thay o nhap gia.", runId);
    logFieldIdentity("PRICE_INPUT_DIAGNOSTICS", firstScoped.label, firstScoped.container, firstScoped.input);
    assertFieldMatchesExpectedLabel(firstScoped.input, "gia ban", "PRICE_FIELD_SCOPE_MISMATCH");
    sendProgress(requestId, "PRICE_SCOPE_VERIFIED", "Da xac nhan dung o gia ban.", runId);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (!isCurrentFlow(requestId, runId)) throw new Error("STALE_FILL_FLOW");
      log("PRICE_FILL_ATTEMPT", { requestId, attempt });
      const scoped = attempt === 1 ? firstScoped : findScopedPriceField();
      if (scoped.error === "PRICE_FIELD_SCOPE_MISMATCH") throw new Error(scoped.error);
      const field = scoped.input;
      if (!field) {
        log("PRICE_VERIFY_FAILED", { requestId, attempt, reason: "FIELD_NOT_FOUND_AFTER_RERENDER" });
        await sleep(STEP_DELAY_MS);
        continue;
      }
      assertFieldMatchesExpectedLabel(field, "gia ban", "PRICE_FIELD_SCOPE_MISMATCH");

      sendProgress(requestId, "STEP_PRICE_FILL_START", "Dang dien gia...", runId);
      dispatchInput(field, expectedDigits);
      log("PRICE_VALUE_SET", { requestId, attempt, digitsLength: expectedDigits.length });
      log("PRICE_VERIFY_START", { requestId, attempt });
      await sleep(800);

      const currentScoped = findScopedPriceField();
      if (currentScoped.error === "PRICE_FIELD_SCOPE_MISMATCH") throw new Error(currentScoped.error);
      const currentField = currentScoped.input || field;
      assertFieldMatchesExpectedLabel(currentField, "gia ban", "PRICE_FIELD_SCOPE_MISMATCH");
      const currentDigits = readFieldValue(currentField).replace(/\D/g, "");
      const validationGone = !hasPriceMinimumValidation();
      const titleScoped = findScopedTitleField();
      const titleStillCorrect = titleScoped.input && normalizeText(readFieldValue(titleScoped.input)) === normalizeText(expectedTitle);
      if (currentDigits === expectedDigits && validationGone && titleStillCorrect) {
        log("PRICE_VERIFY_SUCCESS", { requestId, attempt, currentDigits });
        sendProgress(requestId, "PRICE_VERIFY_SUCCESS", "Da xac nhan gia da duoc dien.", runId);
        sendProgress(requestId, "PRICE_VALIDATION_CLEARED", "Thong bao loi gia da bien mat.", runId);
        sendProgress(requestId, "TITLE_STILL_CORRECT", "Tieu de van dung.", runId);
        sendProgress(requestId, "PRICE_FILLED", "Da dien gia.", runId);
        return;
      }

      log("PRICE_VERIFY_FAILED", {
        requestId,
        attempt,
        currentDigits,
        expectedDigits,
        validationGone,
        titleStillCorrect
      });
      await sleep(250);
    }

    log("PRICE_STATE_NOT_PERSISTED", { requestId });
    throw new Error("PRICE_STATE_NOT_PERSISTED");
  }

  async function fillWarrantyPolicy(value) {
    if (!value) return false;
    const field = findFieldByHints(["bao hanh", "warranty"], "input, textarea, [contenteditable='true']");
    if (field) {
      dispatchInput(field, value);
      return true;
    }
    const option = findButtonLikeByText(value) || findButtonLikeContaining(value);
    if (option) {
      safeClick(option, "warranty_option");
      return true;
    }
    return false;
  }

  function emitCategoryDetailState(requestId, runId) {
    const text = pageText();
    if (text.includes("do dien tu") && text.includes("linh kien")) {
      sendProgress(requestId, "CATEGORY_DETAIL_ALREADY_SET", "Danh mục chi tiết đã có sẵn trên form.", runId);
    }
  }

  function verifySelectedOption(labelHints, optionHints) {
    const field = findDropdownFieldByLabel(labelHints);
    return fieldOrNearbyTextContains(field, optionHints) || textMatchesAny(pageText(), optionHints);
  }

  async function verifyRequiredCompletion(draft, runId) {
    const requestId = draft.requestId;
    const descriptionField = (
      findFieldByHints(["mo ta tin dang", "mo ta", "description", "noi dung tin"], "textarea, input, [contenteditable='true']") ||
      findEditableNearText("mo ta tin dang") ||
      findEditableNearText("mo ta")
    );
    const descriptionOk = descriptionField && controlledFieldValueMatches(readFieldValue(descriptionField), draft.description.slice(0, C.MAX_DESCRIPTION_LENGTH));
    if (!descriptionOk) throw new Error("DESCRIPTION_STATE_NOT_PERSISTED");

    const titleScoped = findScopedTitleField();
    const titleOk = titleScoped.input && controlledFieldValueMatches(readFieldValue(titleScoped.input), draft.title);
    if (!titleOk) throw new Error("TITLE_STATE_NOT_PERSISTED");

    const priceScoped = findScopedPriceField();
    if (priceScoped.error === "PRICE_FIELD_SCOPE_MISMATCH") throw new Error(priceScoped.error);
    const priceDigits = priceScoped.input ? readFieldValue(priceScoped.input).replace(/\D/g, "") : "";
    if (priceDigits !== String(draft.price) || hasPriceMinimumValidation()) throw new Error("PRICE_STATE_NOT_PERSISTED");

    if (!verifySelectedOption(["tinh trang", "condition"], labelMaps.condition[draft.condition])) throw new Error("CONDITION_OPTION_NOT_FOUND");
    if (!verifySelectedOption(["loai linh kien", "loai thiet bi", "loai"], labelMaps.componentType[draft.componentType])) throw new Error("COMPONENT_TYPE_OPTION_NOT_FOUND");
    if (!verifySelectedOption(["thiet bi", "device"], labelMaps.deviceType[draft.deviceType])) throw new Error("DEVICE_OPTION_NOT_FOUND");
    if (!hasUploadedImage()) throw new Error("MANUAL_IMAGE_TIMEOUT");

    const text = pageText();
    if (text.includes("do dien tu") && text.includes("linh kien")) {
      sendProgress(requestId, "CATEGORY_DETAIL_ALREADY_SET", "Danh mục chi tiết đã có sẵn trên form.", runId);
    }
  }

  async function fillRemainingFields(draft, runId) {
    sendProgress(draft.requestId, "FILLING_REMAINING_FIELDS", "Dang dien cac truong con lai tren Cho Tot.", runId);
    sendProgress(draft.requestId, "STEP_REMAINING_FIELDS_START", "STEP_REMAINING_FIELDS_START", runId);
    emitCategoryDetailState(draft.requestId, runId);
    await fillScopedTitle(draft.requestId, runId, draft.title);
    await fillChototPrice(draft.requestId, runId, draft.price, draft.title);

    sendProgress(draft.requestId, "STEP_CONDITION_START", "Đang chọn tình trạng...", runId);
    await fillDropdownByLabel({
      requestId: draft.requestId,
      runId,
      fieldCode: "CONDITION",
      labelHints: ["tinh trang", "condition"],
      optionHints: labelMaps.condition[draft.condition],
      fieldErrorCode: "CONDITION_FIELD_NOT_FOUND",
      optionErrorCode: "CONDITION_OPTION_NOT_FOUND"
    });
    sendProgress(draft.requestId, "STEP_CONDITION_FILLED", "Đã chọn tình trạng.", runId);

    sendProgress(draft.requestId, "STEP_COMPONENT_TYPE_START", "Đang chọn loại linh kiện...", runId);
    await fillDropdownByLabel({
      requestId: draft.requestId,
      runId,
      fieldCode: "COMPONENT_TYPE",
      labelHints: ["loai linh kien", "loai thiet bi", "loai"],
      optionHints: labelMaps.componentType[draft.componentType],
      fieldErrorCode: "COMPONENT_TYPE_FIELD_NOT_FOUND",
      optionErrorCode: "COMPONENT_TYPE_OPTION_NOT_FOUND"
    });
    sendProgress(draft.requestId, "STEP_COMPONENT_TYPE_FILLED", "Đã chọn loại linh kiện.", runId);

    sendProgress(draft.requestId, "STEP_DEVICE_START", "Đang chọn thiết bị...", runId);
    await fillDropdownByLabel({
      requestId: draft.requestId,
      runId,
      fieldCode: "DEVICE",
      labelHints: ["thiet bi", "device"],
      optionHints: labelMaps.deviceType[draft.deviceType],
      fieldErrorCode: "DEVICE_FIELD_NOT_FOUND",
      optionErrorCode: "DEVICE_OPTION_NOT_FOUND"
    });
    sendProgress(draft.requestId, "STEP_DEVICE_FILLED", "Đã chọn thiết bị.", runId);

    sendProgress(draft.requestId, "STEP_WARRANTY_START", "Đang kiểm tra thông tin bảo hành...", runId);
    if (!draft.warrantyPolicy) {
      sendProgress(draft.requestId, "STEP_WARRANTY_SKIPPED", "Không có thông tin bảo hành cần điền.", runId);
    } else {
      try {
        const warrantyFilled = await fillWarrantyPolicy(draft.warrantyPolicy);
        sendProgress(
          draft.requestId,
          warrantyFilled ? "STEP_WARRANTY_FILLED" : "STEP_WARRANTY_SKIPPED",
          warrantyFilled ? "Đã điền thông tin bảo hành." : "Chưa tìm thấy trường bảo hành, vui lòng kiểm tra thủ công.",
          runId
        );
      } catch (error) {
        log("WARRANTY_FILL_FAILED", { requestId: draft.requestId, error: error?.message });
        sendProgress(draft.requestId, "STEP_WARRANTY_SKIPPED", "Chưa điền được bảo hành, vui lòng kiểm tra thủ công.", runId);
      }
    }

    await verifyRequiredCompletion(draft, runId);
    sendProgress(draft.requestId, "READY_FOR_MANUAL_REVIEW", "Đã điền xong. Vui lòng kiểm tra và bấm Đăng tin thủ công.", runId);
  }

  async function runFill(draft, runId) {
    log("Starting safe fill", { requestId: draft.requestId, runId });
    await ensureCategoryIfNeeded(draft.requestId, runId);
    await fillDescription(draft.requestId, draft.description, runId);
    await waitForManualImage(draft.requestId, runId);
    if (!isCurrentFlow(draft.requestId, runId)) throw new Error("STALE_FILL_FLOW");
    await fillRemainingFields(draft, runId);

    return {
      ok: true,
      requestId: draft.requestId,
      code: "READY_FOR_MANUAL_REVIEW",
      message: "Đã điền form. Vui lòng kiểm tra và bấm Đăng tin thủ công.",
      warnings: ["IMAGE_UPLOAD_NOT_SUPPORTED"]
    };
  }

  async function requestAndFillPendingDraft() {
    const response = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: "DRAFT_RETRIEVAL_TIMEOUT" }), 8000);
      safeSendRuntimeMessage({ type: C.RUNTIME_GET_PENDING_DRAFT }, (message) => {
        clearTimeout(timer);
        resolve(message?.ok ? message : { ok: false, error: message?.error || "DRAFT_RETRIEVAL_FAILED" });
      });
    });

    if (!response?.ok) {
      log(response?.error || "NO_PENDING_DRAFT");
      return;
    }

    const draft = response.draft;
    if (flowState.activeRequestId === draft.requestId) {
      log("DUPLICATE_FILL_FLOW_IGNORED", { requestId: draft.requestId });
      return;
    }

    flowState.activeRequestId = draft.requestId;
    flowState.activeRunId += 1;
    flowState.contextInvalidated = false;
    const runId = flowState.activeRunId;

    try {
      const result = await runFill(draft, runId);
      if (isCurrentFlow(draft.requestId, runId)) {
        safeSendRuntimeMessage({ type: C.RUNTIME_FILL_RESULT, result }, () => {});
      }
    } catch (error) {
      log("FILL_FAILED", { requestId: draft?.requestId, error: error?.message, runId });
      if (isCurrentFlow(draft.requestId, runId)) {
        safeSendRuntimeMessage({
          type: C.RUNTIME_FILL_RESULT,
          result: {
            ok: false,
            requestId: draft?.requestId,
            error: error?.message || "UNEXPECTED_FILL_ERROR"
          }
        }, () => {});
      }
    } finally {
      if (isCurrentFlow(draft.requestId, runId)) {
        flowState.activeRequestId = "";
      }
    }
  }

  requestAndFillPendingDraft();
  console.log(C.LOG_PREFIX, "Cho Tot filler ready");
})();
