const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const skuCategoryRuleService = require('./skuCategoryRule.service');

function toId(value) {
  return Number(value);
}

exports.listRules = asyncHandler(async (req, res) => {
  const rules = await skuCategoryRuleService.listRules();
  res.json({
    success: true,
    data: rules,
    meta: { total: rules.length, server_time: new Date().toISOString() }
  });
});

exports.createRule = asyncHandler(async (req, res) => {
  const rule = await skuCategoryRuleService.createRule(req.body);
  res.status(201).json({
    success: true,
    data: rule,
    message: 'Đã thêm quy ước gợi ý danh mục.',
    meta: { server_time: new Date().toISOString() }
  });
});

exports.updateRule = asyncHandler(async (req, res) => {
  if (Object.keys(req.body || {}).length === 0) {
    throw new AppError('Request body cannot be empty.', 400, 'VALIDATION_ERROR');
  }
  const rule = await skuCategoryRuleService.updateRule(toId(req.params.id), req.body);
  res.json({
    success: true,
    data: rule,
    message: 'Đã cập nhật quy ước gợi ý danh mục.',
    meta: { server_time: new Date().toISOString() }
  });
});

exports.deleteRule = asyncHandler(async (req, res) => {
  const rule = await skuCategoryRuleService.deleteRule(toId(req.params.id));
  res.json({
    success: true,
    data: rule,
    message: 'Đã xóa quy ước gợi ý danh mục.',
    meta: { server_time: new Date().toISOString() }
  });
});
