const DEFAULT_PREFIX = 'APP_';
const DEFAULT_SEPARATOR = '_';

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

function toCamelCase(parts) {
  return parts
    .map((part, i) => {
      if (i === 0) return part.toLowerCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

function parseBoolean(raw, key) {
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  throw new ConfigError(`Invalid boolean for ${key}: ${JSON.stringify(raw)}`);
}

function parseNumber(raw, key) {
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new ConfigError(`Invalid number for ${key}: empty string`);
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    throw new ConfigError(`Invalid number for ${key}: ${JSON.stringify(raw)}`);
  }
  return n;
}

function parseInteger(raw, key) {
  const n = parseNumber(raw, key);
  if (!Number.isInteger(n)) {
    throw new ConfigError(`Invalid integer for ${key}: ${JSON.stringify(raw)}`);
  }
  return n;
}

function parseJson(raw, key) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`Invalid JSON for ${key}: ${err.message}`);
  }
}

function parseString(raw) {
  return raw;
}

function parseEnum(raw, key, options) {
  if (options.length === 0) {
    throw new ConfigError(`Enum for ${key} has no allowed values`);
  }
  const value = raw.trim();
  if (!options.includes(value)) {
    throw new ConfigError(
      `Invalid value for ${key}: ${JSON.stringify(raw)} (allowed: ${options.join(', ')})`
    );
  }
  return value;
}

function parseList(raw, key, itemParser) {
  if (raw.trim() === '') return [];
  return raw.split(',').map((item) => itemParser(item, key));
}

function defaultValue(spec) {
  if (spec.default === undefined) return undefined;
  if (typeof spec.default === 'function') {
    return spec.default();
  }
  return spec.default;
}

function applyParser(spec, raw, key) {
  switch (spec.type) {
    case 'string':
      return parseString(raw);
    case 'boolean':
      return parseBoolean(raw, key);
    case 'number':
      return parseNumber(raw, key);
    case 'integer':
      return parseInteger(raw, key);
    case 'json':
      return parseJson(raw, key);
    case 'enum':
      return parseEnum(raw, key, spec.values || []);
    case 'list': {
      const itemParser = spec.itemParser || ((v) => v);
      return parseList(raw, key, itemParser);
    }
    default:
      throw new ConfigError(`Unknown type for ${key}: ${spec.type}`);
  }
}

function resolveKey(envKey, spec, prefix, separator) {
  if (spec.key) return spec.key;
  if (!prefix) return envKey;
  const stripped = envKey.slice(prefix.length);
  const parts = stripped.split(separator);
  return toCamelCase(parts);
}

/**
 * Read environment variables into a typed configuration object.
 *
 * The function is deliberately strict: a variable that is present but cannot be
 * parsed raises a ConfigError rather than silently falling back to a default.
 * Silent fallbacks hide misconfiguration until production, which is the exact
 * failure this library exists to prevent.
 *
 * @param {Object} specs - Map of environment variable names to value specs.
 * @param {Object} [options]
 * @param {Object} [options.env] - Environment source. Defaults to process.env.
 * @param {string} [options.prefix] - Only variables starting with this prefix are considered.
 * @param {string} [options.separator] - Separator used when deriving camelCase keys.
 * @returns {Object} The parsed configuration object.
 */
export function readConfig(specs, options = {}) {
  const env = options.env || process.env;
  const prefix = options.prefix !== undefined ? options.prefix : DEFAULT_PREFIX;
  const separator = options.separator !== undefined ? options.separator : DEFAULT_SEPARATOR;

  const result = {};

  for (const [envKey, spec] of Object.entries(specs)) {
    if (prefix && !envKey.startsWith(prefix)) {
      continue;
    }

    const key = resolveKey(envKey, spec, prefix, separator);
    const raw = env[envKey];

    if (raw === undefined) {
      const fallback = defaultValue(spec);
      if (fallback === undefined) {
        if (spec.required) {
          throw new ConfigError(`Missing required env var: ${envKey}`);
        }
        continue;
      }
      result[key] = fallback;
      continue;
    }

    result[key] = applyParser(spec, raw, envKey);
  }

  return result;
}
