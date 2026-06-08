import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as scripts from '../src/scripts.js'

const {
  logger,
  mergeConfigContent,
  mergeTsConfigs,
  mergeConfigObjects,
  parsePath,
  parseJson,
  resolveJSON,
  updateCompilerOptions,
  writeTsconfig,
} = scripts

test('logger', () => {
  const originalError = console.error
  const calls: unknown[][] = []
  console.error = (...args: unknown[]) => {
    calls.push(args)
  }

  try {
    logger({ isDebugging: false })('error')('foo')('bar')(new Error('baz'))
  } finally {
    console.error = originalError
  }

  assert.equal(calls.length, 3)
})

test('resolveJSON', () => {
  const json = resolveJSON('./tests/cfg1.json', true)
  assert.deepStrictEqual(json, {
    compilerOptions: {
      target: 'esnext',
    },
    extends: './cfg3.json',
  })
})

test('resolveJSON returns empty config for unreadable JSON', () => {
  const json = resolveJSON('./tests/does-not-exist.json')
  assert.deepStrictEqual(json, {})
})

test('mergeConfigContent to override sibling', () => {
  const json = mergeConfigContent(['./tests/cfg1.json', './tests/cfg2.json'], process.cwd())
  assert.deepStrictEqual(json, {
    compilerOptions: {
      target: 'commonjs',
      allowJS: true,
    },
  })
})

test('mergeConfigContent deeply extend the parent', () => {
  const json = mergeConfigContent(['./tests/cfg4.json', './tests/cfg2.json'], process.cwd())
  assert.deepStrictEqual(json, {
    compilerOptions: {
      target: 'commonjs',
      rootDir: 'src',
    },
  })
})

test('mergeConfigs', () => {
  const json = mergeTsConfigs({
    tsconfigs: ['./tests/cfg1.json', './tests/cfg2.json'],
    isTesting: true,
  })
  assert.deepStrictEqual(json, {
    compilerOptions: {
      target: 'commonjs',
      allowJS: true,
    },
  })
})

test('writeTsconfig', () => {
  const json = writeTsconfig(
    { compilerOptions: { target: 'esnext' as keyof unknown } },
    process.cwd(),
    './tmp/tsconfig.json',
    true,
  )
  assert.deepStrictEqual(json, {
    compilerOptions: {
      target: 'esnext',
    },
  })
})

test('updateCompilerOptions delete compilerOptions', () => {
  const json = updateCompilerOptions({ allowJS: 'delete' }, { target: 'esnext' as keyof unknown, allowJS: true }, {})
  assert.deepStrictEqual(json, { target: 'esnext' })
})

test('updateCompilerOptions with path', () => {
  const json = updateCompilerOptions(
    { target: 'esnext' as keyof unknown, allowJS: true },
    {},
    { 'item/*': ['foo', 'bar'] },
  )
  assert.deepStrictEqual(json, {
    target: 'esnext',
    allowJS: true,
    paths: { 'item/*': ['foo', 'bar'] },
  })
})

test('updateCompilerOptions merges current paths, compiler paths, and path option', () => {
  const json = updateCompilerOptions(
    { paths: { '@app/*': ['src/app/*'] }, strict: true },
    { target: 'esnext' as keyof unknown, paths: { '@core/*': ['src/core/*'] } },
    { '@test/*': ['tests/*'] },
  )
  assert.deepStrictEqual(json, {
    target: 'esnext',
    paths: {
      '@core/*': ['src/core/*'],
      '@app/*': ['src/app/*'],
      '@test/*': ['tests/*'],
    },
    strict: true,
  })
})

test('mergeConfigObjects', () => {
  const json = mergeConfigObjects(
    { compilerOptions: { target: 'esnext' as keyof unknown, allowJS: true } },
    { compilerOptions: { target: 'commonjs' as keyof unknown } },
  )
  assert.deepStrictEqual(json, {
    compilerOptions: { target: 'commonjs', allowJS: true },
  })
})

test('mergeConfigObjects appends include and exclude arrays', () => {
  const json = mergeConfigObjects(
    {
      compilerOptions: { target: 'esnext' as keyof unknown },
      include: ['src'],
      exclude: ['dist'],
    },
    {
      compilerOptions: { strict: true },
      include: ['tests'],
      exclude: ['coverage'],
    },
  )
  assert.deepStrictEqual(json, {
    compilerOptions: { target: 'esnext', strict: true },
    include: ['src', 'tests'],
    exclude: ['dist', 'coverage'],
  })
})

test('parsePath', () => {
  const json = parsePath('{"item/*": ["foo", "bar"]}', true)
  assert.deepStrictEqual(json, { 'item/*': ['foo', 'bar'] })
})

test('parsePath returns empty paths for invalid JSON', () => {
  const json = parsePath('{"item/*": ["foo": "bar"]}')
  assert.deepStrictEqual(json, {})
})

test('parseJson handles tsconfig comments and trailing commas', () => {
  const json = parseJson('{"compilerOptions": { "target": "esnext", }, // trailing\n "include": ["src",], }')
  assert.deepStrictEqual(json, {
    compilerOptions: { target: 'esnext' },
    include: ['src'],
  })
})

test('parseJson preserves comment markers inside strings', () => {
  const json = parseJson(
    `{
      "compilerOptions": {
        "baseUrl": "https://example.test//packages",
        /* block comment */
        "paths": {
          "pkg/*": ["src/*",],
        },
      },
    }`,
  )
  assert.deepStrictEqual(json, {
    compilerOptions: {
      baseUrl: 'https://example.test//packages',
      paths: {
        'pkg/*': ['src/*'],
      },
    },
  })
})

test('mergeConfigs with path option', () => {
  const json = mergeTsConfigs({
    tsconfigs: ['./tests/cfg2.json'],
    path: '{"item/*": ["foo", "bar"]}',
    isTesting: true,
  })
  assert.deepStrictEqual(json, {
    compilerOptions: {
      target: 'commonjs',
      paths: {
        'item/*': ['foo', 'bar'],
      },
    },
  })
})

test('mergeConfigs with include, exclude, and compiler options', () => {
  const json = mergeTsConfigs({
    tsconfigs: ['./tests/cfg2.json'],
    include: ['src'],
    exclude: ['dist'],
    compilerOptions: { strict: true },
    isTesting: true,
  })
  assert.deepStrictEqual(json, {
    compilerOptions: {
      target: 'commonjs',
      strict: true,
    },
    exclude: ['dist'],
    include: ['src'],
  })
})

test('mergeConfigs returns undefined without tsconfig files', () => {
  const json = mergeTsConfigs({ isTesting: true })
  assert.equal(json, undefined)
})
