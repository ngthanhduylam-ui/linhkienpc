import { apiGet, apiPatch, apiPut } from "../api/apiClient";

const SALE_DELIVERY_NOTE_SETTINGS_PATH = "/admin/print-template-settings/sale-delivery-note";

export async function getSaleDeliveryNoteTemplateSettings(options = {}) {
  const response = await apiGet(SALE_DELIVERY_NOTE_SETTINGS_PATH, {}, options);
  return response?.data ?? null;
}

export async function saveSaleDeliveryNoteCustomTemplate(config, options = {}) {
  const response = await apiPut(
    SALE_DELIVERY_NOTE_SETTINGS_PATH,
    { custom_template_config: config },
    options
  );
  return response?.data ?? null;
}

export async function setSaleDeliveryNoteActiveTemplate(activeTemplate, options = {}) {
  const response = await apiPatch(
    SALE_DELIVERY_NOTE_SETTINGS_PATH,
    { active_template: activeTemplate },
    options
  );
  return response?.data ?? null;
}
