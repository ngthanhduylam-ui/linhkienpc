const AppError = require('../../utils/AppError');

// Phase boundary: this is the authoritative persistence schema and immutable
// system default. Phases 1-3 leave the current renderer unchanged; Phase 2 only
// manages/duplicates settings, Phase 3 edits Custom, Phase 4 integrates rendering,
// and Phase 5 adds per-print fallback behavior.
const DOCUMENT_TYPE = 'sale_delivery_note';
const SYSTEM_TEMPLATE_SCHEMA_VERSION = 1;
const MAX_CONFIG_BYTES = 32 * 1024;

const SYSTEM_TEMPLATE_CONFIG = deepFreeze({
  schemaVersion: SYSTEM_TEMPLATE_SCHEMA_VERSION,
  paper: {
    size: 'A4',
    orientation: 'portrait',
    marginMm: 7
  },
  sections: {
    shopHeader: {
      visible: true,
      showLogo: true,
      name: 'Vi Tính Phước Tài',
      address: '98/14 đường số 5, P.17, Q. Gò Vấp',
      phone: '0933712571',
      email: 'vitinhphuoctai@gmail.com'
    },
    documentTitle: {
      visible: true,
      text: 'PHIẾU BÁN & GIAO HÀNG'
    },
    receiptMetadata: {
      visible: true,
      showVoucherCode: true,
      showDate: true,
      showTime: true
    },
    customerInformation: {
      visible: true,
      showName: true,
      showPhone: true,
      showAddress: true,
      showNote: true
    },
    productTable: {
      visible: true,
      showIndex: true,
      showProductName: true,
      showSaleNote: true,
      showQuantity: true,
      showUnitPrice: true,
      showDiscount: true,
      showLineTotal: true
    },
    totals: {
      visible: true,
      showGrossTotal: true,
      showDiscountTotal: true,
      showGrandTotal: true
    },
    signatures: {
      visible: true,
      sellerLabel: 'Người bán',
      sellerHint: '(Ký và ghi rõ họ tên)',
      customerLabel: 'Khách hàng',
      customerHint: '(Kiểm tra và ký nhận)'
    },
    notes: {
      visible: true,
      title: 'Lưu ý:',
      items: [
        'Quý khách vui lòng kiểm tra hàng hóa và thông tin trên phiếu trước khi ký nhận.',
        'Hàng đã mua không trả lại, trừ trường hợp được cửa hàng chấp thuận.',
        'Sản phẩm bảo hành theo điều kiện của nhà sản xuất hoặc nhà phân phối.',
        'Không bảo hành các trường hợp rách tem, cháy nổ, vào nước, móp méo, lỗi vật lý hoặc sử dụng sai quy định.',
        'Sản phẩm bán ra có thể kèm tem và số serial để phục vụ đối chiếu.'
      ]
    }
  }
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function cloneSystemTemplateConfig() {
  return JSON.parse(JSON.stringify(SYSTEM_TEMPLATE_CONFIG));
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addTypeError(errors, field, expected) {
  errors.push({ field, issue: `must be ${expected}` });
}

function validateObject(value, field, allowedKeys, errors) {
  if (!isPlainObject(value)) {
    addTypeError(errors, field, 'an object');
    return false;
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      errors.push({ field: `${field}.${key}`, issue: 'field is not allowed' });
    }
  }
  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push({ field: `${field}.${key}`, issue: 'field is required' });
    }
  }
  return true;
}

function validateBoolean(value, field, errors) {
  if (typeof value !== 'boolean') addTypeError(errors, field, 'a boolean');
}

function validateEnum(value, field, allowedValues, errors) {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    errors.push({ field, issue: `must be one of: ${allowedValues.join(', ')}` });
  }
}

function validateNumber(value, field, { min, max }, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    addTypeError(errors, field, 'a finite number');
    return;
  }
  if (value < min || value > max) {
    errors.push({ field, issue: `must be between ${min} and ${max}` });
  }
}

function validatePlainText(value, field, { min = 1, max }, errors) {
  if (typeof value !== 'string') {
    addTypeError(errors, field, 'a string');
    return;
  }
  if (value.length < min || value.length > max) {
    errors.push({ field, issue: `length must be between ${min} and ${max} characters` });
  }

  // Config text is rendered as text only. Reject common markup, executable URL,
  // style-block, and expression syntax so this store cannot become a code channel.
  if (
    /<\s*\/?\s*[a-z][^>]*>/i.test(value)
    || /\{\{|\}\}|\$\{/.test(value)
    || /javascript\s*:/i.test(value)
    || /(?:\bfunction(?:\s+[\w$]+)?\s*\(|\beval\s*\(|\bnew\s+Function\s*\(|\b(?:window|document)\s*\.|=>)/i.test(value)
    || /(?:^|[;\s])(?:color|background(?:-color)?|font-size|position|display)\s*:\s*[^;]+;?/i.test(value)
    || /(?:^|\s)(?:body|html|#[\w-]+|\.[\w-]+)\s*\{[^}]*\}/i.test(value)
  ) {
    errors.push({ field, issue: 'must contain plain text only' });
  }
}

function validateCustomTemplateConfig(config) {
  let serialized;
  try {
    serialized = JSON.stringify(config);
  } catch {
    throw new AppError('Custom print template configuration is not serializable.', 400, 'PRINT_TEMPLATE_VALIDATION_ERROR', [
      { field: 'body.custom_template_config', issue: 'must be valid JSON data' }
    ]);
  }

  if (typeof serialized !== 'string') {
    throw new AppError('Custom print template configuration is required.', 400, 'PRINT_TEMPLATE_VALIDATION_ERROR', [
      { field: 'body.custom_template_config', issue: 'must be an object' }
    ]);
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONFIG_BYTES) {
    throw new AppError('Custom print template configuration is too large.', 413, 'PRINT_TEMPLATE_CONFIG_TOO_LARGE', [
      { field: 'body.custom_template_config', issue: `serialized JSON must not exceed ${MAX_CONFIG_BYTES} bytes` }
    ]);
  }

  const errors = [];
  const rootKeys = ['schemaVersion', 'paper', 'sections'];
  if (!validateObject(config, 'body.custom_template_config', rootKeys, errors)) {
    throw new AppError('Invalid custom print template configuration.', 400, 'PRINT_TEMPLATE_VALIDATION_ERROR', errors);
  }

  if (!Number.isInteger(config.schemaVersion) || config.schemaVersion !== SYSTEM_TEMPLATE_SCHEMA_VERSION) {
    errors.push({
      field: 'body.custom_template_config.schemaVersion',
      issue: `must equal ${SYSTEM_TEMPLATE_SCHEMA_VERSION}`
    });
  }

  const paperField = 'body.custom_template_config.paper';
  if (validateObject(config.paper, paperField, ['size', 'orientation', 'marginMm'], errors)) {
    // Phase 1 mirrors the current renderer, which supports A4 portrait only.
    validateEnum(config.paper.size, `${paperField}.size`, ['A4'], errors);
    validateEnum(config.paper.orientation, `${paperField}.orientation`, ['portrait'], errors);
    validateNumber(config.paper.marginMm, `${paperField}.marginMm`, { min: 0, max: 30 }, errors);
  }

  const sectionKeys = [
    'shopHeader',
    'documentTitle',
    'receiptMetadata',
    'customerInformation',
    'productTable',
    'totals',
    'signatures',
    'notes'
  ];
  const sectionsField = 'body.custom_template_config.sections';
  if (validateObject(config.sections, sectionsField, sectionKeys, errors)) {
    const shop = config.sections.shopHeader;
    const shopField = `${sectionsField}.shopHeader`;
    if (validateObject(shop, shopField, ['visible', 'showLogo', 'name', 'address', 'phone', 'email'], errors)) {
      validateBoolean(shop.visible, `${shopField}.visible`, errors);
      validateBoolean(shop.showLogo, `${shopField}.showLogo`, errors);
      validatePlainText(shop.name, `${shopField}.name`, { max: 120 }, errors);
      validatePlainText(shop.address, `${shopField}.address`, { max: 240 }, errors);
      validatePlainText(shop.phone, `${shopField}.phone`, { max: 50 }, errors);
      validatePlainText(shop.email, `${shopField}.email`, { max: 120 }, errors);
    }

    const title = config.sections.documentTitle;
    const titleField = `${sectionsField}.documentTitle`;
    if (validateObject(title, titleField, ['visible', 'text'], errors)) {
      validateBoolean(title.visible, `${titleField}.visible`, errors);
      validatePlainText(title.text, `${titleField}.text`, { max: 120 }, errors);
    }

    const metadata = config.sections.receiptMetadata;
    const metadataField = `${sectionsField}.receiptMetadata`;
    if (validateObject(metadata, metadataField, ['visible', 'showVoucherCode', 'showDate', 'showTime'], errors)) {
      validateBoolean(metadata.visible, `${metadataField}.visible`, errors);
      validateBoolean(metadata.showVoucherCode, `${metadataField}.showVoucherCode`, errors);
      validateBoolean(metadata.showDate, `${metadataField}.showDate`, errors);
      validateBoolean(metadata.showTime, `${metadataField}.showTime`, errors);
    }

    const customer = config.sections.customerInformation;
    const customerField = `${sectionsField}.customerInformation`;
    if (validateObject(customer, customerField, ['visible', 'showName', 'showPhone', 'showAddress', 'showNote'], errors)) {
      validateBoolean(customer.visible, `${customerField}.visible`, errors);
      validateBoolean(customer.showName, `${customerField}.showName`, errors);
      validateBoolean(customer.showPhone, `${customerField}.showPhone`, errors);
      validateBoolean(customer.showAddress, `${customerField}.showAddress`, errors);
      validateBoolean(customer.showNote, `${customerField}.showNote`, errors);
    }

    const productTable = config.sections.productTable;
    const productTableField = `${sectionsField}.productTable`;
    const productTableKeys = [
      'visible',
      'showIndex',
      'showProductName',
      'showSaleNote',
      'showQuantity',
      'showUnitPrice',
      'showDiscount',
      'showLineTotal'
    ];
    if (validateObject(productTable, productTableField, productTableKeys, errors)) {
      productTableKeys.forEach((key) => validateBoolean(productTable[key], `${productTableField}.${key}`, errors));
    }

    const totals = config.sections.totals;
    const totalsField = `${sectionsField}.totals`;
    const totalsKeys = ['visible', 'showGrossTotal', 'showDiscountTotal', 'showGrandTotal'];
    if (validateObject(totals, totalsField, totalsKeys, errors)) {
      totalsKeys.forEach((key) => validateBoolean(totals[key], `${totalsField}.${key}`, errors));
    }

    const signatures = config.sections.signatures;
    const signaturesField = `${sectionsField}.signatures`;
    const signatureKeys = ['visible', 'sellerLabel', 'sellerHint', 'customerLabel', 'customerHint'];
    if (validateObject(signatures, signaturesField, signatureKeys, errors)) {
      validateBoolean(signatures.visible, `${signaturesField}.visible`, errors);
      signatureKeys.slice(1).forEach((key) => {
        validatePlainText(signatures[key], `${signaturesField}.${key}`, { max: 100 }, errors);
      });
    }

    const notes = config.sections.notes;
    const notesField = `${sectionsField}.notes`;
    if (validateObject(notes, notesField, ['visible', 'title', 'items'], errors)) {
      validateBoolean(notes.visible, `${notesField}.visible`, errors);
      validatePlainText(notes.title, `${notesField}.title`, { max: 60 }, errors);
      if (!Array.isArray(notes.items)) {
        addTypeError(errors, `${notesField}.items`, 'an array');
      } else {
        if (notes.items.length < 1 || notes.items.length > 10) {
          errors.push({ field: `${notesField}.items`, issue: 'must contain between 1 and 10 items' });
        }
        notes.items.forEach((item, index) => {
          validatePlainText(item, `${notesField}.items[${index}]`, { max: 500 }, errors);
        });
      }
    }
  }

  if (errors.length) {
    throw new AppError('Invalid custom print template configuration.', 400, 'PRINT_TEMPLATE_VALIDATION_ERROR', errors);
  }

  return JSON.parse(serialized);
}

module.exports = {
  DOCUMENT_TYPE,
  SYSTEM_TEMPLATE_SCHEMA_VERSION,
  MAX_CONFIG_BYTES,
  SYSTEM_TEMPLATE_CONFIG,
  cloneSystemTemplateConfig,
  validateCustomTemplateConfig,
  deepFreeze
};
