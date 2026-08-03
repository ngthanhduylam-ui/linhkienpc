const AppError = require('../../utils/AppError');

const BUILDER_SCHEMA_VERSION = 1;
const BUILDER_MAX_BLOCKS = 100;
const BUILDER_MAX_CONFIG_BYTES = 128 * 1024;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PRODUCT_TABLE_COLUMN_KEYS = Object.freeze([
  'index',
  'productName',
  'quantity',
  'unitPrice',
  'discount',
  'lineTotal'
]);
const BUILDER_BLOCK_TYPES = Object.freeze([
  'text',
  'title',
  'logo',
  'shopInfo',
  'voucherMetadata',
  'customerInfo',
  'productTable',
  'totals',
  'signatures',
  'notes',
  'horizontalRule'
]);
const BLOCK_MINIMUMS = Object.freeze({
  text: [20, 8],
  title: [35, 10],
  logo: [12, 10],
  shopInfo: [45, 18],
  voucherMetadata: [38, 18],
  customerInfo: [70, 20],
  productTable: [110, 45],
  totals: [45, 18],
  signatures: [70, 24],
  notes: [45, 20],
  horizontalRule: [20, 1]
});
const TEXT_PROP_KEYS = Object.freeze([
  'text', 'fontSizePt', 'bold', 'italic', 'underline', 'textAlign', 'lineHeight'
]);
const PROP_KEYS_BY_TYPE = Object.freeze({
  text: TEXT_PROP_KEYS,
  title: TEXT_PROP_KEYS,
  notes: TEXT_PROP_KEYS,
  logo: ['preserveAspectRatio'],
  shopInfo: ['showLogo', 'showName', 'showAddress', 'showPhone', 'showEmail', 'fontSizePt', 'textAlign'],
  voucherMetadata: ['showVoucherCode', 'showDate', 'showTime', 'fontSizePt', 'textAlign'],
  customerInfo: ['showName', 'showPhone', 'showAddress', 'showNote', 'fontSizePt'],
  productTable: [
    'columnVisibility',
    'columnWidthWeights',
    'bodyFontSizePt',
    'headerFontSizePt',
    'cellPaddingMm',
    'showSaleNote'
  ],
  totals: ['showSubtotal', 'showDiscount', 'showGrandTotal', 'fontSizePt', 'textAlign'],
  signatures: ['sellerLabel', 'sellerHint', 'customerLabel', 'customerHint', 'fontSizePt', 'writingSpaceMm'],
  horizontalRule: ['thicknessMm', 'lineStyle']
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addTypeError(errors, field, expected) {
  errors.push({ field, issue: `must be ${expected}` });
}

function validateExactObject(value, field, allowedKeys, errors) {
  if (!isPlainObject(value)) {
    addTypeError(errors, field, 'an object');
    return false;
  }
  Object.keys(value).forEach((key) => {
    if (!allowedKeys.includes(key)) errors.push({ field: `${field}.${key}`, issue: 'field is not allowed' });
  });
  allowedKeys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push({ field: `${field}.${key}`, issue: 'field is required' });
    }
  });
  return true;
}

function validateNumber(value, field, min, max, errors, { integer = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    addTypeError(errors, field, integer ? 'a finite integer' : 'a finite number');
    return;
  }
  if (value < min || value > max) errors.push({ field, issue: `must be between ${min} and ${max}` });
}

function validateBoolean(value, field, errors) {
  if (typeof value !== 'boolean') addTypeError(errors, field, 'a boolean');
}

function validateEnum(value, field, allowed, errors) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    errors.push({ field, issue: `must be one of: ${allowed.join(', ')}` });
  }
}

function validatePlainText(value, field, max, errors, { allowEmpty = true } = {}) {
  if (typeof value !== 'string') {
    addTypeError(errors, field, 'a string');
    return;
  }
  if ((!allowEmpty && value.length === 0) || value.length > max) {
    errors.push({ field, issue: `length must be ${allowEmpty ? 'between 0' : 'between 1'} and ${max} characters` });
  }
  if (
    /<\s*\/?\s*[a-z][^>]*>/i.test(value)
    || /\{\{|\}\}|\$\{/.test(value)
    || /javascript\s*:/i.test(value)
    || /(?:\bfunction(?:\s+[\w$]+)?\s*\(|\beval\s*\(|\bnew\s+Function\s*\(|\b(?:window|document)\s*\.|=>)/i.test(value)
    || /(?:^|[;\s])(?:color|background(?:-color)?|font-size|position|display)\s*:\s*[^;]+;?/i.test(value)
  ) {
    errors.push({ field, issue: 'must contain plain text only' });
  }
}

function validateTextProps(props, field, errors) {
  validatePlainText(props.text, `${field}.text`, 4000, errors);
  validateNumber(props.fontSizePt, `${field}.fontSizePt`, 6, 48, errors);
  ['bold', 'italic', 'underline'].forEach((key) => validateBoolean(props[key], `${field}.${key}`, errors));
  validateEnum(props.textAlign, `${field}.textAlign`, ['left', 'center', 'right'], errors);
  validateNumber(props.lineHeight, `${field}.lineHeight`, 1, 2.5, errors);
}

function validateColumnMap(value, field, errors, validator) {
  if (!validateExactObject(value, field, PRODUCT_TABLE_COLUMN_KEYS, errors)) return;
  PRODUCT_TABLE_COLUMN_KEYS.forEach((key) => validator(value[key], `${field}.${key}`));
}

function validateBlockProps(block, field, errors) {
  const propsField = `${field}.props`;
  const allowedKeys = PROP_KEYS_BY_TYPE[block.type];
  if (!allowedKeys || !validateExactObject(block.props, propsField, allowedKeys, errors)) return;
  const props = block.props;

  if (['text', 'title', 'notes'].includes(block.type)) {
    validateTextProps(props, propsField, errors);
  } else if (block.type === 'logo') {
    validateBoolean(props.preserveAspectRatio, `${propsField}.preserveAspectRatio`, errors);
  } else if (block.type === 'shopInfo') {
    ['showLogo', 'showName', 'showAddress', 'showPhone', 'showEmail'].forEach((key) => {
      validateBoolean(props[key], `${propsField}.${key}`, errors);
    });
    validateNumber(props.fontSizePt, `${propsField}.fontSizePt`, 6, 32, errors);
    validateEnum(props.textAlign, `${propsField}.textAlign`, ['left', 'center', 'right'], errors);
  } else if (block.type === 'voucherMetadata') {
    ['showVoucherCode', 'showDate', 'showTime'].forEach((key) => validateBoolean(props[key], `${propsField}.${key}`, errors));
    validateNumber(props.fontSizePt, `${propsField}.fontSizePt`, 6, 32, errors);
    validateEnum(props.textAlign, `${propsField}.textAlign`, ['left', 'center', 'right'], errors);
  } else if (block.type === 'customerInfo') {
    ['showName', 'showPhone', 'showAddress', 'showNote'].forEach((key) => validateBoolean(props[key], `${propsField}.${key}`, errors));
    validateNumber(props.fontSizePt, `${propsField}.fontSizePt`, 6, 32, errors);
  } else if (block.type === 'productTable') {
    validateColumnMap(props.columnVisibility, `${propsField}.columnVisibility`, errors, (value, path) => validateBoolean(value, path, errors));
    validateColumnMap(props.columnWidthWeights, `${propsField}.columnWidthWeights`, errors, (value, path) => validateNumber(value, path, 1, 100, errors));
    validateNumber(props.bodyFontSizePt, `${propsField}.bodyFontSizePt`, 6, 18, errors);
    validateNumber(props.headerFontSizePt, `${propsField}.headerFontSizePt`, 6, 18, errors);
    validateNumber(props.cellPaddingMm, `${propsField}.cellPaddingMm`, 0.5, 4, errors);
    validateBoolean(props.showSaleNote, `${propsField}.showSaleNote`, errors);
  } else if (block.type === 'totals') {
    ['showSubtotal', 'showDiscount', 'showGrandTotal'].forEach((key) => validateBoolean(props[key], `${propsField}.${key}`, errors));
    validateNumber(props.fontSizePt, `${propsField}.fontSizePt`, 6, 32, errors);
    validateEnum(props.textAlign, `${propsField}.textAlign`, ['left', 'center', 'right'], errors);
  } else if (block.type === 'signatures') {
    ['sellerLabel', 'sellerHint', 'customerLabel', 'customerHint'].forEach((key) => {
      validatePlainText(props[key], `${propsField}.${key}`, key.endsWith('Hint') ? 240 : 120, errors);
    });
    validateNumber(props.fontSizePt, `${propsField}.fontSizePt`, 6, 32, errors);
    validateNumber(props.writingSpaceMm, `${propsField}.writingSpaceMm`, 5, 80, errors);
  } else if (block.type === 'horizontalRule') {
    validateNumber(props.thicknessMm, `${propsField}.thicknessMm`, 0.1, 5, errors);
    validateEnum(props.lineStyle, `${propsField}.lineStyle`, ['solid', 'dashed'], errors);
  }
}

function serializeAndCheckSize(document) {
  let serialized;
  try {
    serialized = JSON.stringify(document);
  } catch {
    throw new AppError('Builder Draft is not serializable.', 400, 'PRINT_TEMPLATE_BUILDER_VALIDATION_ERROR', [
      { field: 'body.draft', issue: 'must be valid JSON data' }
    ]);
  }
  if (typeof serialized !== 'string') {
    throw new AppError('Builder Draft is required.', 400, 'PRINT_TEMPLATE_BUILDER_VALIDATION_ERROR', [
      { field: 'body.draft', issue: 'must be an object' }
    ]);
  }
  if (Buffer.byteLength(serialized, 'utf8') > BUILDER_MAX_CONFIG_BYTES) {
    throw new AppError('Builder Draft is too large.', 413, 'PRINT_TEMPLATE_BUILDER_CONFIG_TOO_LARGE', [
      { field: 'body.draft', issue: `serialized JSON must not exceed ${BUILDER_MAX_CONFIG_BYTES} bytes` }
    ]);
  }
  return serialized;
}

function validateBuilderDocument(document) {
  const serialized = serializeAndCheckSize(document);
  const errors = [];
  if (!validateExactObject(document, 'body.draft', ['builderSchemaVersion', 'paper', 'blocks'], errors)) {
    throw new AppError('Invalid Builder Draft.', 400, 'PRINT_TEMPLATE_BUILDER_VALIDATION_ERROR', errors);
  }
  if (document.builderSchemaVersion !== BUILDER_SCHEMA_VERSION) {
    errors.push({ field: 'body.draft.builderSchemaVersion', issue: `must equal ${BUILDER_SCHEMA_VERSION}` });
  }
  if (validateExactObject(document.paper, 'body.draft.paper', ['size', 'orientation', 'marginMm', 'gridMm'], errors)) {
    validateEnum(document.paper.size, 'body.draft.paper.size', ['A4'], errors);
    validateEnum(document.paper.orientation, 'body.draft.paper.orientation', ['portrait'], errors);
    validateNumber(document.paper.marginMm, 'body.draft.paper.marginMm', 0, 30, errors);
    validateNumber(document.paper.gridMm, 'body.draft.paper.gridMm', 1, 10, errors);
  }
  if (!Array.isArray(document.blocks)) {
    addTypeError(errors, 'body.draft.blocks', 'an array');
  } else {
    if (document.blocks.length > BUILDER_MAX_BLOCKS) {
      errors.push({ field: 'body.draft.blocks', issue: `must contain at most ${BUILDER_MAX_BLOCKS} blocks` });
    }
    const ids = new Set();
    document.blocks.forEach((block, index) => {
      const field = `body.draft.blocks[${index}]`;
      if (!validateExactObject(block, field, ['id', 'type', 'xMm', 'yMm', 'widthMm', 'heightMm', 'zIndex', 'locked', 'props'], errors)) return;
      if (typeof block.id !== 'string' || block.id.length < 1 || block.id.length > 64 || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(block.id)) {
        errors.push({ field: `${field}.id`, issue: 'must be a safe identifier of 1 to 64 characters' });
      } else if (ids.has(block.id)) {
        errors.push({ field: `${field}.id`, issue: 'must be unique' });
      } else ids.add(block.id);
      validateEnum(block.type, `${field}.type`, BUILDER_BLOCK_TYPES, errors);
      ['xMm', 'yMm', 'widthMm', 'heightMm'].forEach((key) => validateNumber(block[key], `${field}.${key}`, 0, key.startsWith('x') || key.startsWith('width') ? A4_WIDTH_MM : A4_HEIGHT_MM, errors));
      const minimum = BLOCK_MINIMUMS[block.type];
      if (minimum && typeof block.widthMm === 'number' && Number.isFinite(block.widthMm) && block.widthMm < minimum[0]) {
        errors.push({ field: `${field}.widthMm`, issue: `must be at least ${minimum[0]}` });
      }
      if (minimum && typeof block.heightMm === 'number' && Number.isFinite(block.heightMm) && block.heightMm < minimum[1]) {
        errors.push({ field: `${field}.heightMm`, issue: `must be at least ${minimum[1]}` });
      }
      if ([block.xMm, block.widthMm].every((value) => typeof value === 'number' && Number.isFinite(value)) && block.xMm + block.widthMm > A4_WIDTH_MM) {
        errors.push({ field: field, issue: 'horizontal geometry must remain inside A4' });
      }
      if ([block.yMm, block.heightMm].every((value) => typeof value === 'number' && Number.isFinite(value)) && block.yMm + block.heightMm > A4_HEIGHT_MM) {
        errors.push({ field: field, issue: 'vertical geometry must remain inside A4' });
      }
      validateNumber(block.zIndex, `${field}.zIndex`, 1, BUILDER_MAX_BLOCKS, errors, { integer: true });
      validateBoolean(block.locked, `${field}.locked`, errors);
      validateBlockProps(block, field, errors);
    });
  }

  if (errors.length) {
    throw new AppError('Invalid Builder Draft.', 400, 'PRINT_TEMPLATE_BUILDER_VALIDATION_ERROR', errors);
  }
  return JSON.parse(serialized);
}

function createDefaultBuilderDocument() {
  const visibility = Object.fromEntries(PRODUCT_TABLE_COLUMN_KEYS.map((key) => [key, true]));
  const weights = { index: 11, productName: 91, quantity: 13, unitPrice: 27, discount: 27, lineTotal: 27 };
  const blocks = [
    ['builder-logo', 'logo', 7, 7, 28, 22, { preserveAspectRatio: true }],
    ['builder-shop', 'shopInfo', 36, 7, 110, 22, { showLogo: false, showName: true, showAddress: true, showPhone: true, showEmail: true, fontSizePt: 9, textAlign: 'center' }],
    ['builder-voucher', 'voucherMetadata', 155, 7, 48, 22, { showVoucherCode: true, showDate: true, showTime: true, fontSizePt: 9, textAlign: 'left' }],
    ['builder-title', 'title', 20, 35, 170, 14, { text: 'PHIẾU BÁN & GIAO HÀNG', fontSizePt: 17, bold: true, italic: false, underline: false, textAlign: 'center', lineHeight: 1.2 }],
    ['builder-customer', 'customerInfo', 7, 53, 196, 24, { showName: true, showPhone: true, showAddress: true, showNote: true, fontSizePt: 9 }],
    ['builder-products', 'productTable', 7, 82, 196, 72, { columnVisibility: visibility, columnWidthWeights: weights, bodyFontSizePt: 9, headerFontSizePt: 9, cellPaddingMm: 2, showSaleNote: true }],
    ['builder-totals', 'totals', 121, 158, 82, 25, { showSubtotal: true, showDiscount: true, showGrandTotal: true, fontSizePt: 9, textAlign: 'right' }],
    ['builder-signatures', 'signatures', 7, 188, 196, 34, { sellerLabel: 'Người bán', sellerHint: '(Ký và ghi rõ họ tên)', customerLabel: 'Khách hàng', customerHint: '(Kiểm tra và ký nhận)', fontSizePt: 9, writingSpaceMm: 14 }],
    ['builder-notes', 'notes', 7, 228, 196, 48, { text: 'Lưu ý:\n- Vui lòng kiểm tra hàng trước khi nhận.\n- Giữ phiếu để được hỗ trợ bảo hành.', fontSizePt: 8.25, bold: false, italic: false, underline: false, textAlign: 'left', lineHeight: 1.35 }]
  ].map(([id, type, xMm, yMm, widthMm, heightMm, props], index) => ({
    id, type, xMm, yMm, widthMm, heightMm, zIndex: index + 1, locked: false, props: clone(props)
  }));
  return validateBuilderDocument({
    builderSchemaVersion: BUILDER_SCHEMA_VERSION,
    paper: { size: 'A4', orientation: 'portrait', marginMm: 7, gridMm: 2 },
    blocks
  });
}

module.exports = {
  BUILDER_SCHEMA_VERSION,
  BUILDER_MAX_BLOCKS,
  BUILDER_MAX_CONFIG_BYTES,
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  PRODUCT_TABLE_COLUMN_KEYS,
  BUILDER_BLOCK_TYPES,
  BLOCK_MINIMUMS,
  PROP_KEYS_BY_TYPE,
  validateBuilderDocument,
  createDefaultBuilderDocument,
  cloneBuilderDocument: clone
};
