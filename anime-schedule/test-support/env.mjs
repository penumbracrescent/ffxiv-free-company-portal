// Unit tests must never accidentally use deployment credentials. Database
// integration tests require an explicit, local-only URL and a *_test database.
const integrationDatabase = process.env.ANIME_TEST_DATABASE_URL;
if (integrationDatabase) {
  const url = new URL(integrationDatabase);
  if (!['127.0.0.1', 'localhost', 'postgres'].includes(url.hostname) ||
      !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname)) {
    throw new Error('Integration tests require a local, explicitly named *_test database');
  }
}
const testDatabase = integrationDatabase || 'postgresql://unit:unit@127.0.0.1:1/unit_test';
process.env.ANIME_DATABASE_URL = testDatabase;
process.env.DATABASE_URL = testDatabase;
