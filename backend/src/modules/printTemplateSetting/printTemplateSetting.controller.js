const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const printTemplateSettingService = require('./printTemplateSetting.service');

function requireExactBody(body, allowedKeys) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Request body must be an object.', 400, 'PRINT_TEMPLATE_VALIDATION_ERROR');
  }

  const keys = Object.keys(body);
  const details = [];
  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      details.push({ field: `body.${key}`, issue: 'field is not allowed' });
    }
  }
  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) {
      details.push({ field: `body.${key}`, issue: 'field is required' });
    }
  }
  if (details.length) {
    throw new AppError('Invalid request body.', 400, 'PRINT_TEMPLATE_VALIDATION_ERROR', details);
  }
}

exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await printTemplateSettingService.getSettings();
  res.json({
    success: true,
    data: settings,
    meta: { server_time: new Date().toISOString() }
  });
});

exports.saveCustomTemplate = asyncHandler(async (req, res) => {
  requireExactBody(req.body, ['custom_template_config']);
  const settings = await printTemplateSettingService.saveCustomTemplate(req.body.custom_template_config);
  res.json({
    success: true,
    data: settings,
    message: 'Đã lưu mẫu in tùy chỉnh.',
    meta: { server_time: new Date().toISOString() }
  });
});

exports.changeActiveTemplate = asyncHandler(async (req, res) => {
  requireExactBody(req.body, ['active_template']);
  const settings = await printTemplateSettingService.changeActiveTemplate(req.body.active_template);
  res.json({
    success: true,
    data: settings,
    message: 'Đã cập nhật mẫu in đang sử dụng.',
    meta: { server_time: new Date().toISOString() }
  });
});

exports.requireExactBody = requireExactBody;
