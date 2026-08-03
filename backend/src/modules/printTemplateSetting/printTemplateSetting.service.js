const { pool } = require('../../config/database');
const AppError = require('../../utils/AppError');
const {
  DOCUMENT_TYPE,
  SYSTEM_TEMPLATE_SCHEMA_VERSION,
  cloneSystemTemplateConfig,
  validateCustomTemplateConfig,
  upgradeSaleDeliveryNoteConfigToLatest
} = require('./saleDeliveryNoteTemplate');

const SELECT_SETTINGS_SQL = `
  SELECT
    id,
    document_type,
    active_template,
    custom_template_config,
    custom_template_schema_version,
    created_at,
    updated_at
  FROM print_template_settings
  WHERE document_type = ?
  LIMIT 1
`;

function missingSettingsError() {
  return new AppError(
    'Print template settings are missing. Apply the required database migration.',
    500,
    'PRINT_TEMPLATE_SETTINGS_MISSING'
  );
}

function normalizeDatabaseError(error) {
  if (error instanceof AppError) return error;
  return new AppError(
    'Unable to access print template settings.',
    500,
    'PRINT_TEMPLATE_SETTINGS_DATABASE_ERROR'
  );
}

function parseStoredConfig(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw new AppError(
        'Stored custom print template configuration is invalid.',
        500,
        'PRINT_TEMPLATE_SETTINGS_INVALID'
      );
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  throw new AppError(
    'Stored custom print template configuration is invalid.',
    500,
    'PRINT_TEMPLATE_SETTINGS_INVALID'
  );
}

function validateStoredCustom(row, { selectionConflict = false } = {}) {
  const config = parseStoredConfig(row.custom_template_config);
  const schemaVersion = row.custom_template_schema_version === null
    || row.custom_template_schema_version === undefined
    ? null
    : Number(row.custom_template_schema_version);

  if (config === null && schemaVersion === null) return null;
  if (
    config === null
    || schemaVersion === null
    || ![1, SYSTEM_TEMPLATE_SCHEMA_VERSION].includes(schemaVersion)
    || Number(config.schemaVersion) !== schemaVersion
  ) {
    throw new AppError(
      selectionConflict
        ? 'A valid custom print template must be saved before it can be selected.'
        : 'Stored custom print template settings are inconsistent.',
      selectionConflict ? 409 : 500,
      selectionConflict ? 'CUSTOM_PRINT_TEMPLATE_INVALID' : 'PRINT_TEMPLATE_SETTINGS_INVALID'
    );
  }

  try {
    validateCustomTemplateConfig(config, { allowLegacy: true });
    return upgradeSaleDeliveryNoteConfigToLatest(config);
  } catch (error) {
    if (selectionConflict) {
      throw new AppError(
        'A valid custom print template must be saved before it can be selected.',
        409,
        'CUSTOM_PRINT_TEMPLATE_INVALID',
        error.details || null
      );
    }
    throw new AppError(
      'Stored custom print template configuration is invalid.',
      500,
      'PRINT_TEMPLATE_SETTINGS_INVALID',
      error.details || null
    );
  }
}

function mapSettings(row) {
  if (!row) throw missingSettingsError();
  if (!['system', 'custom'].includes(row.active_template)) {
    throw new AppError(
      'Stored active print template selection is invalid.',
      500,
      'PRINT_TEMPLATE_SETTINGS_INVALID'
    );
  }

  const customConfig = validateStoredCustom(row);
  if (row.active_template === 'custom' && customConfig === null) {
    throw new AppError(
      'Stored custom print template selection has no configuration.',
      500,
      'PRINT_TEMPLATE_SETTINGS_INVALID'
    );
  }

  return {
    document_type: DOCUMENT_TYPE,
    active_template: row.active_template,
    system_template: {
      available: true,
      immutable: true,
      schema_version: SYSTEM_TEMPLATE_SCHEMA_VERSION,
      config: cloneSystemTemplateConfig()
    },
    custom_template: {
      exists: customConfig !== null,
      schema_version: customConfig === null ? null : SYSTEM_TEMPLATE_SCHEMA_VERSION,
      config: customConfig
    }
  };
}

async function selectSettings(executor, { forUpdate = false } = {}) {
  const sql = forUpdate ? `${SELECT_SETTINGS_SQL.trimEnd()} FOR UPDATE` : SELECT_SETTINGS_SQL;
  const [rows] = await executor.query(sql, [DOCUMENT_TYPE]);
  if (!rows.length) throw missingSettingsError();
  return rows[0];
}

async function withTransaction(work) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original safe domain/database error.
      }
    }
    throw normalizeDatabaseError(error);
  } finally {
    if (connection) connection.release();
  }
}

async function getSettings() {
  try {
    const row = await selectSettings(pool);
    return mapSettings(row);
  } catch (error) {
    throw normalizeDatabaseError(error);
  }
}

async function saveCustomTemplate(config) {
  const validatedConfig = validateCustomTemplateConfig(config);

  return withTransaction(async (connection) => {
    await selectSettings(connection, { forUpdate: true });
    const [result] = await connection.query(
      `
        UPDATE print_template_settings
        SET custom_template_config = ?, custom_template_schema_version = ?
        WHERE document_type = ?
      `,
      [JSON.stringify(validatedConfig), SYSTEM_TEMPLATE_SCHEMA_VERSION, DOCUMENT_TYPE]
    );
    if (result.affectedRows !== 1) throw missingSettingsError();

    const updatedRow = await selectSettings(connection);
    return mapSettings(updatedRow);
  });
}

function validateActiveTemplate(value) {
  if (!['system', 'custom'].includes(value)) {
    throw new AppError('Invalid active print template selection.', 400, 'PRINT_TEMPLATE_VALIDATION_ERROR', [
      { field: 'body.active_template', issue: 'must be one of: system, custom' }
    ]);
  }
  return value;
}

async function changeActiveTemplate(activeTemplate) {
  const selection = validateActiveTemplate(activeTemplate);

  return withTransaction(async (connection) => {
    const currentRow = await selectSettings(connection, { forUpdate: true });
    if (selection === 'custom') {
      const customConfig = validateStoredCustom(currentRow, { selectionConflict: true });
      if (customConfig === null) {
        throw new AppError(
          'A custom print template must be saved before it can be selected.',
          409,
          'CUSTOM_PRINT_TEMPLATE_REQUIRED'
        );
      }
    }

    const [result] = await connection.query(
      'UPDATE print_template_settings SET active_template = ? WHERE document_type = ?',
      [selection, DOCUMENT_TYPE]
    );
    if (result.affectedRows !== 1) throw missingSettingsError();

    const updatedRow = await selectSettings(connection);
    return mapSettings(updatedRow);
  });
}

module.exports = {
  getSettings,
  saveCustomTemplate,
  changeActiveTemplate,
  validateActiveTemplate,
  mapSettings,
  parseStoredConfig,
  normalizeDatabaseError,
  SELECT_SETTINGS_SQL
};
