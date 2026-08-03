import test from "node:test";
import assert from "node:assert/strict";
import {
  canSelectCustomTemplate,
  cloneTemplateConfig,
  getTemplateMetadata,
  hasActiveTemplateSelectionChanged,
  isTemplateSelectionValid,
  validatePrintTemplateSettingsResponse
} from "./printTemplateSettings.js";

function systemConfig() {
  return {
    schemaVersion: 1,
    paper: { size: "A4", orientation: "portrait", marginMm: 7 },
    sections: { documentTitle: { visible: true, text: "PHIẾU BÁN & GIAO HÀNG" } }
  };
}

function response(overrides = {}) {
  return {
    document_type: "sale_delivery_note",
    active_template: "system",
    system_template: {
      available: true,
      immutable: true,
      schema_version: 1,
      config: systemConfig()
    },
    custom_template: { exists: false, schema_version: null, config: null },
    ...overrides
  };
}

test("accepts the System-only response and keeps System selected by default", () => {
  const settings = validatePrintTemplateSettingsResponse(response());
  assert.equal(settings.active_template, "system");
  assert.equal(settings.custom_template.exists, false);
  assert.equal(isTemplateSelectionValid(settings, "system"), true);
  assert.equal(isTemplateSelectionValid(settings, "custom"), false);
});

test("accepts an existing valid Custom response", () => {
  const config = systemConfig();
  const settings = validatePrintTemplateSettingsResponse(response({
    active_template: "custom",
    custom_template: { exists: true, schema_version: 1, config }
  }));
  assert.equal(canSelectCustomTemplate(settings), true);
  assert.equal(isTemplateSelectionValid(settings, "custom"), true);
});

test("cloning System creates an independent object", () => {
  const original = systemConfig();
  const clone = cloneTemplateConfig(original);
  clone.paper.marginMm = 12;
  assert.equal(original.paper.marginMm, 7);
  assert.notEqual(clone, original);
});

test("creating Custom data does not imply frontend activation", () => {
  const settings = validatePrintTemplateSettingsResponse(response({
    custom_template: { exists: true, schema_version: 1, config: systemConfig() }
  }));
  assert.equal(settings.active_template, "system");
  assert.equal(settings.custom_template.exists, true);
});

test("extracts valid A4 portrait metadata", () => {
  assert.deepEqual(getTemplateMetadata(systemConfig()), {
    schemaVersion: 1,
    size: "A4",
    orientation: "portrait",
    orientationLabel: "Dọc",
    marginMm: 7
  });
});

test("rejects malformed or unavailable System config without fallback", () => {
  assert.throws(
    () => validatePrintTemplateSettingsResponse(response({
      system_template: { available: false, immutable: true, schema_version: 1, config: null }
    })),
    /Mẫu gốc/
  );
  assert.throws(() => getTemplateMetadata({ schemaVersion: 1 }), /khổ giấy/);
});

test("rejects inconsistent Custom existence and config states", () => {
  assert.throws(
    () => validatePrintTemplateSettingsResponse(response({
      custom_template: { exists: false, schema_version: 1, config: systemConfig() }
    })),
    /không nhất quán/
  );
  assert.throws(
    () => validatePrintTemplateSettingsResponse(response({
      custom_template: { exists: true, schema_version: null, config: null }
    })),
    /không đầy đủ/
  );
});

test("rejects a Custom schema version unsupported by the current System schema", () => {
  const config = systemConfig();
  config.schemaVersion = 2;
  assert.throws(
    () => validatePrintTemplateSettingsResponse(response({
      custom_template: { exists: true, schema_version: 2, config }
    })),
    /không được hệ thống hiện tại hỗ trợ/
  );
});

test("dirty-state calculation requires two valid different selections", () => {
  assert.equal(hasActiveTemplateSelectionChanged("system", "custom"), true);
  assert.equal(hasActiveTemplateSelectionChanged("system", "system"), false);
  assert.equal(hasActiveTemplateSelectionChanged("system", "unknown"), false);
});

test("never silently falls back from malformed active Custom to System", () => {
  assert.throws(
    () => validatePrintTemplateSettingsResponse(response({ active_template: "custom" })),
    /đang được chọn/
  );
});
