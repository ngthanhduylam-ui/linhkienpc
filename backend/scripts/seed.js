const { pool } = require('../src/config/database');
const env = require('../src/config/env');
const { hashPassword } = require('../src/utils/password');

const defaultCategories = [
  { code: 'cpu', name: 'CPU' },
  { code: 'mainboard', name: 'Mainboard' },
  { code: 'ram', name: 'RAM' },
  { code: 'vga', name: 'VGA' },
  { code: 'ssd', name: 'SSD' },
  { code: 'hdd', name: 'HDD' },
  { code: 'psu', name: 'PSU' },
  { code: 'case', name: 'Case' }
];

async function seedAdmin(database = pool) {
  const [rows] = await database.query(
    'SELECT id FROM admins WHERE username = ? LIMIT 1',
    [env.seed.adminUsername]
  );

  if (rows.length > 0) {
    console.log(`Default admin already exists: ${env.seed.adminUsername}`);
    return;
  }

  if (!env.seed.adminPassword) {
    throw new Error(
      `Cannot create admin "${env.seed.adminUsername}": DEFAULT_ADMIN_PASSWORD is required.`
    );
  }

  const passwordHash = await hashPassword(env.seed.adminPassword);

  await database.query(
    `INSERT INTO admins (username, password_hash, display_name, is_active)
     VALUES (?, ?, ?, 1)`,
    [env.seed.adminUsername, passwordHash, env.seed.adminDisplayName]
  );

  console.log(`Seeded default admin: ${env.seed.adminUsername}`);
}

async function seedCategories() {
  for (const category of defaultCategories) {
    await pool.query(
      `INSERT INTO categories (code, name, is_active)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`,
      [category.code, category.name]
    );
  }

  console.log('Seeded default categories.');
}

async function run() {
  await seedCategories();
  await seedAdmin();
  console.log('Seed completed.');
  await pool.end();
}

if (require.main === module) {
  run().catch(async (error) => {
    console.error('Seed failed:', error.message);
    await pool.end();
    process.exit(1);
  });
}

module.exports = {
  seedAdmin,
  seedCategories,
  run
};
