-- Experimental Builder Draft storage only. This does not activate or render the draft.
ALTER TABLE print_template_settings
  ADD COLUMN builder_draft_config JSON NULL AFTER custom_template_schema_version,
  ADD COLUMN builder_draft_schema_version SMALLINT UNSIGNED NULL AFTER builder_draft_config,
  ADD COLUMN builder_draft_revision INT UNSIGNED NOT NULL DEFAULT 0 AFTER builder_draft_schema_version,
  ADD COLUMN builder_draft_updated_at DATETIME NULL AFTER builder_draft_revision,
  ADD CONSTRAINT chk_print_template_builder_draft_pair CHECK (
    (
      builder_draft_config IS NULL
      AND builder_draft_schema_version IS NULL
      AND builder_draft_updated_at IS NULL
    )
    OR
    (
      builder_draft_config IS NOT NULL
      AND builder_draft_schema_version IS NOT NULL
      AND builder_draft_schema_version > 0
      AND builder_draft_updated_at IS NOT NULL
    )
  );
