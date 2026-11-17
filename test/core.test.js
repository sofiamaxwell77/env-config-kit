import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, ConfigError } from '../src/index.js';

test('reads a string variable', () => {
  const cfg = readConfig(
    { APP_NAME: { type: 'string' } },
    { env: { APP_NAME: 'svc' } }
  );
  assert.equal(cfg.name, 'svc');
});

test('parses boolean truthy and falsy forms', () => {
  const cfg = readConfig(
    {
      APP_ON: { type: 'boolean' },
      APP_OFF: { type: 'boolean' },
    },
    { env: { APP_ON: 'yes', APP_OFF: '0' } }
  );
  assert.equal(cfg.on, true);
  assert.equal(cfg.off, false);
});

test('rejects invalid boolean values', () => {
  assert.throws(
    () => readConfig({ APP_FLAG: { type: 'boolean' } }, { env: { APP_FLAG: 'maybe' } }),
    (err) => {
      assert.ok(err instanceof ConfigError);
      assert.match(err.message, /Invalid boolean for APP_FLAG/);
      return true;
    }
  );
});

test('parses numbers and rejects empty strings', () => {
  const cfg = readConfig(
    { APP_PORT: { type: 'number' } },
    { env: { APP_PORT: '8080.5' } }
  );
  assert.equal(cfg.port, 8080.5);

  assert.throws(
    () => readConfig({ APP_PORT: { type: 'number' } }, { env: { APP_PORT: '  ' } }),
    ConfigError
  );
});

test('parses integers and rejects fractional values', () => {
  const cfg = readConfig(
    { APP_WORKERS: { type: 'integer' } },
    { env: { APP_WORKERS: '4' } }
  );
  assert.equal(cfg.workers, 4);

  assert.throws(
    () => readConfig({ APP_WORKERS: { type: 'integer' } }, { env: { APP_WORKERS: '4.2' } }),
    ConfigError
  );
});

test('parses JSON objects and arrays', () => {
  const cfg = readConfig(
    {
      APP_LIMITS: { type: 'json' },
      APP_TAGS: { type: 'json' },
    },
    { env: { APP_LIMITS: '{"max":10}', APP_TAGS: '["a","b"]' } }
  );
  assert.deepEqual(cfg.limits, { max: 10 });
  assert.deepEqual(cfg.tags, ['a', 'b']);
});

test('rejects malformed JSON', () => {
  assert.throws(
    () => readConfig({ APP_LIMITS: { type: 'json' } }, { env: { APP_LIMITS: '{oops' } }),
    ConfigError
  );
});

test('validates enum membership', () => {
  const cfg = readConfig(
    { APP_MODE: { type: 'enum', values: ['dev', 'prod'] } },
    { env: { APP_MODE: 'prod' } }
  );
  assert.equal(cfg.mode, 'prod');

  assert.throws(
    () => readConfig(
      { APP_MODE: { type: 'enum', values: ['dev', 'prod'] } },
      { env: { APP_MODE: 'staging' } }
    ),
    ConfigError
  );
});

test('parses comma separated lists with a custom item parser', () => {
  const cfg = readConfig(
    {
      APP_PORTS: {
        type: 'list',
        itemParser: (item, key) => {
          const n = Number(item.trim());
          if (!Number.isInteger(n)) {
            throw new ConfigError(`Invalid integer for ${key}: ${JSON.stringify(item)}`);
          }
          return n;
        },
      },
    },
    { env: { APP_PORTS: '80, 443,8080' } }
  );
  assert.deepEqual(cfg.ports, [80, 443, 8080]);
});

test('treats an empty list variable as an empty array', () => {
  const cfg = readConfig(
    { APP_PORTS: { type: 'list', itemParser: (v) => v } },
    { env: { APP_PORTS: '' } }
  );
  assert.deepEqual(cfg.ports, []);
});

test('applies defaults when the variable is absent', () => {
  const cfg = readConfig(
    {
      APP_HOST: { type: 'string', default: 'localhost' },
      APP_PORT: { type: 'integer', default: () => 3000 },
    },
    { env: {} }
  );
  assert.equal(cfg.host, 'localhost');
  assert.equal(cfg.port, 3000);
});

test('throws for missing required variables', () => {
  assert.throws(
    () => readConfig({ APP_TOKEN: { type: 'string', required: true } }, { env: {} }),
    (err) => {
      assert.ok(err instanceof ConfigError);
      assert.match(err.message, /Missing required env var: APP_TOKEN/);
      return true;
    }
  );
});

test('omits optional absent variables without defaults', () => {
  const cfg = readConfig({ APP_OPTIONAL: { type: 'string' } }, { env: {} });
  assert.equal(Object.prototype.hasOwnProperty.call(cfg, 'optional'), false);
});

test('respects a custom prefix and separator', () => {
  const cfg = readConfig(
    { 'MYAPP__DB__URL': { type: 'string' } },
    { env: { 'MYAPP__DB__URL': 'postgres://localhost' }, prefix: 'MYAPP__', separator: '__' }
  );
  assert.equal(cfg.dbUrl, 'postgres://localhost');
});

test('uses explicit key when provided', () => {
  const cfg = readConfig(
    { APP_DB_URL: { type: 'string', key: 'databaseUrl' } },
    { env: { APP_DB_URL: 'postgres://localhost' } }
  );
  assert.equal(cfg.databaseUrl, 'postgres://localhost');
});

test('ignores variables that do not match the prefix', () => {
  const cfg = readConfig(
    { APP_NAME: { type: 'string' } },
    { env: { APP_NAME: 'svc', OTHER_NAME: 'ignored' } }
  );
  assert.deepEqual(cfg, { name: 'svc' });
});
