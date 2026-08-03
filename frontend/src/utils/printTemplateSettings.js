const ACTIVE_TEMPLATES = new Set(["system", "custom"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function configurationError(message) {
  const error = new Error(message);
  error.name = "PrintTemplateSettingsConfigurationError";
  return error;
}

function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    throw configurationError(`Dữ liệu cấu hình không hợp lệ: ${field}.`);
  }
  return Number(value);
}

export function cloneTemplateConfig(config) {
  if (!isPlainObject(config)) {
    throw configurationError("Không tìm thấy cấu hình Mẫu gốc hợp lệ.");
  }

  if (typeof structuredClone === "function") {
    return structuredClone(config);
  }
  return JSON.parse(JSON.stringify(config));
}

export function getTemplateMetadata(config) {
  if (!isPlainObject(config) || !isPlainObject(config.paper)) {
    throw configurationError("Cấu hình mẫu in thiếu thông tin khổ giấy.");
  }

  const schemaVersion = requirePositiveInteger(config.schemaVersion, "schemaVersion");
  const size = typeof config.paper.size === "string" ? config.paper.size.trim() : "";
  const orientation = typeof config.paper.orientation === "string"
    ? config.paper.orientation.trim()
    : "";
  const marginMm = config.paper.marginMm;

  if (!size || !orientation || typeof marginMm !== "number" || !Number.isFinite(marginMm)) {
    throw configurationError("Cấu hình mẫu in thiếu thông tin khổ giấy hợp lệ.");
  }

  return {
    schemaVersion,
    size,
    orientation,
    orientationLabel: orientation === "portrait" ? "Dọc" : orientation,
    marginMm
  };
}

export function canSelectCustomTemplate(settings) {
  const custom = settings?.custom_template;
  if (!custom || custom.exists !== true || !isPlainObject(custom.config)) return false;
  if (!Number.isSafeInteger(Number(custom.schema_version)) || Number(custom.schema_version) <= 0) return false;
  return Number(custom.schema_version) === Number(custom.config.schemaVersion);
}

export function hasActiveTemplateSelectionChanged(persisted, selected) {
  return ACTIVE_TEMPLATES.has(persisted)
    && ACTIVE_TEMPLATES.has(selected)
    && persisted !== selected;
}

export function validatePrintTemplateSettingsResponse(data) {
  if (!isPlainObject(data) || data.document_type !== "sale_delivery_note") {
    throw configurationError("Phản hồi cấu hình mẫu in không hợp lệ.");
  }
  if (!ACTIVE_TEMPLATES.has(data.active_template)) {
    throw configurationError("Lựa chọn mẫu in đang lưu không hợp lệ.");
  }

  const system = data.system_template;
  if (
    !isPlainObject(system)
    || system.available !== true
    || system.immutable !== true
    || !isPlainObject(system.config)
  ) {
    throw configurationError("Mẫu gốc hệ thống không khả dụng hoặc không đầy đủ.");
  }
  const systemVersion = requirePositiveInteger(system.schema_version, "system_template.schema_version");
  const systemMetadata = getTemplateMetadata(system.config);
  if (systemMetadata.schemaVersion !== systemVersion) {
    throw configurationError("Phiên bản cấu hình Mẫu gốc không nhất quán.");
  }

  const custom = data.custom_template;
  if (!isPlainObject(custom) || typeof custom.exists !== "boolean") {
    throw configurationError("Trạng thái Mẫu tùy chỉnh không hợp lệ.");
  }
  if (custom.exists === false && (custom.config !== null || custom.schema_version !== null)) {
    throw configurationError("Trạng thái Mẫu tùy chỉnh không nhất quán.");
  }
  if (custom.exists === true && !canSelectCustomTemplate(data)) {
    throw configurationError("Cấu hình Mẫu tùy chỉnh không đầy đủ hoặc không nhất quán.");
  }
  if (custom.exists === true) {
    const customMetadata = getTemplateMetadata(custom.config);
    if (customMetadata.schemaVersion !== systemVersion) {
      throw configurationError("Phiên bản Mẫu tùy chỉnh không được hệ thống hiện tại hỗ trợ.");
    }
  }
  if (data.active_template === "custom" && !canSelectCustomTemplate(data)) {
    throw configurationError("Mẫu tùy chỉnh đang được chọn nhưng không có cấu hình hợp lệ.");
  }

  return {
    document_type: data.document_type,
    active_template: data.active_template,
    system_template: {
      available: true,
      immutable: true,
      schema_version: systemVersion,
      config: cloneTemplateConfig(system.config)
    },
    custom_template: custom.exists
      ? {
          exists: true,
          schema_version: Number(custom.schema_version),
          config: cloneTemplateConfig(custom.config)
        }
      : { exists: false, schema_version: null, config: null }
  };
}

export function isTemplateSelectionValid(settings, selectedTemplate) {
  if (selectedTemplate === "system") return Boolean(settings?.system_template?.available);
  if (selectedTemplate === "custom") return canSelectCustomTemplate(settings);
  return false;
}
