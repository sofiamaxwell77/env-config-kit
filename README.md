# env-config-kit

Read environment variables into typed configuration values without third-party dependencies.

```js
import { readConfig, ConfigError } from 'env-config-kit';

const config = readConfig(
  {
    APP_HOST: { type: 'string', default: 'localhost' },
    APP_PORT: { type: 'integer', required: true },
    APP_DEBUG: { type: 'boolean', default: false },
    APP_MODE: { type: 'enum', values: ['dev', 'prod'] },
    APP_LIMITS: { type: 'json' },
  },
  { env: { APP_PORT: '8080', APP_MODE: 'prod', APP_LIMITS: '{"max":10}' } }
);

console.log(config);
// { host: 'localhost', port: 8080, debug: false, mode: 'prod', limits: { max: 10 } }
```

## Why this exists

Most configuration code reads `process.env` directly and relies on truthiness, which turns
`"false"` into `true` and `"0"` into a number that is indistinguishable from a missing value.
The specific problem is that a malformed variable is usually discovered only when the value is
used, far from the place that read it.

This library makes parsing eager and strict. A variable that is present but unparsable raises
`ConfigError` immediately. The trade-off is that a typo in an environment variable stops the
process at startup rather than producing a subtly wrong default. That is the intended behaviour:
configuration errors should be loud and early.

## Behaviour

`readConfig(specs, options)` returns a plain object. By default only variables beginning with
`APP_` are considered, and the remainder is converted to camelCase using `_` as the separator
(`APP_DB_URL` becomes `dbUrl`). Pass `prefix` and `separator` to change this, or pass
`prefix: ''` to read every variable in the environment.

Each spec may set `type` (`string`, `boolean`, `number`, `integer`, `json`, `enum`, `list`),
`required`, `default`, `key`, and for `enum` a `values` array, and for `list` an `itemParser`.
A `default` may be a value or a function returning a value.

A variable that is absent and has no default is omitted from the result unless it is
`required`, in which case `ConfigError` is thrown. A variable that is present is always parsed;
the default is never consulted. Boolean values accept `true`/`false`, `1`/`0`, `yes`/`no`, and
`on`/`off`, case-insensitively.

## The awkward edge

An empty string is not the same as an absent variable. `APP_PORT=''` with `type: 'number'`
throws, because an empty string is a value the operator explicitly set and it cannot be parsed
as a number. If you want an empty string to mean "unset", give the spec a default and do not set
the variable at all.
