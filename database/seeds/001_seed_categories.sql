INSERT INTO categories (code, name, is_active)
VALUES
  ('cpu', 'CPU', 1),
  ('mainboard', 'Mainboard', 1),
  ('ram', 'RAM', 1),
  ('vga', 'VGA', 1),
  ('ssd', 'SSD', 1),
  ('hdd', 'HDD', 1),
  ('psu', 'PSU', 1),
  ('case', 'Case', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;
