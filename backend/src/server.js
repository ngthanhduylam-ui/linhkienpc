const app = require('./app');
const env = require('./config/env');
const { testConnection } = require('./config/database');

async function bootstrap() {
  await testConnection();

  app.listen(env.port, () => {
    console.log(`LINHKIENPC backend is running on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap server:', error.message);
  process.exit(1);
});
