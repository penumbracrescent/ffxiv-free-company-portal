import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const source = readFileSync(new URL('./auth.ts', import.meta.url), 'utf8');
const discordConfig = source.match(/:\s*\[Discord\(\{([\s\S]*?)\n\s*profile\(/)?.[1];
const issuer = discordConfig?.match(/issuer:\s*"([^"]+)"/)?.[1];
const require = createRequire(import.meta.url);
const authRequire = createRequire(require.resolve('next-auth'));
const coreRequire = createRequire(authRequire.resolve('@auth/core/providers/discord'));
const oauth = await import(pathToFileURL(coreRequire.resolve('oauth4webapi')).href);
const server = { issuer, token_endpoint: 'https://discord.com/api/oauth2/token' };
const client = { client_id: 'regression-test-client' };
const parameters = (responseIssuer = issuer, state = 'expected-state') => new URLSearchParams({code:'test-code', iss:responseIssuer, state});

test('Discord has an explicit issuer while Authentik keeps its configured issuer', () => {
  assert.equal(issuer, 'https://discord.com');
  assert.match(source, /issuer:\s*process\.env\.AUTH_AUTHENTIK_ISSUER/);
});
test('the installed OAuth validator accepts Discord callbacks with the correct issuer', () => {
  assert.equal(oauth.validateAuthResponse(server, client, parameters(), 'expected-state').get('code'), 'test-code');
});
test('the prior fallback reproduces the reported issuer error', () => {
  assert.throws(() => oauth.validateAuthResponse({...server,issuer:'https://authjs.dev'}, client, parameters(), 'expected-state'), /unexpected "iss"/);
});
test('a foreign issuer remains rejected', () => {
  assert.throws(() => oauth.validateAuthResponse(server, client, parameters('https://example.invalid'), 'expected-state'), /unexpected "iss"/);
});
test('a wrong state remains rejected', () => {
  assert.throws(() => oauth.validateAuthResponse(server, client, parameters(issuer,'wrong-state'), 'expected-state'), /state/);
});
