import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseArgs } from '../src/program.js'

test('program w/ file', () => {
  const result = parseArgs(['foo.json', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      isTestingCLI: true,
    },
  })
})

test('program w/ files', () => {
  const result = parseArgs(['foo.json', 'bar.json', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json', 'bar.json'],
    help: false,
    options: {
      isTestingCLI: true,
    },
  })
})

test('program w/ boolean compiler option', () => {
  const result = parseArgs(['foo.json', '--allowJs', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      allowJs: true,
      isTestingCLI: true,
    },
  })
})

test('program w/ boolean compiler option value', () => {
  const result = parseArgs(['foo.json', '--allowJs=false', '--strict', 'true', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      allowJs: false,
      strict: true,
      isTestingCLI: true,
    },
  })
})

test('program w/ deleted boolean compiler option', () => {
  const result = parseArgs(['foo.json', '--allowJs', 'delete', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      allowJs: 'delete',
      isTestingCLI: true,
    },
  })
})

test('program w/ aliases', () => {
  const result = parseArgs(['-d', '-i', 'src', 'tests', '-e', 'dist', '-o=tsconfig.build.json', '-t'])
  assert.deepStrictEqual(result, {
    files: [],
    help: false,
    options: {
      debug: true,
      include: ['src', 'tests'],
      exclude: ['dist'],
      out: 'tsconfig.build.json',
      isTestingCLI: true,
    },
  })
})

test('program w/ string compiler option', () => {
  const result = parseArgs(['foo.json', '--module', 'node', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      module: 'node',
      isTestingCLI: true,
    },
  })
})

test('program w/ array compiler option', () => {
  const result = parseArgs(['foo.json', '--lib', 'foo', 'bar', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      lib: ['foo', 'bar'],
      isTestingCLI: true,
    },
  })
})

test('program w/ array compiler option value', () => {
  const result = parseArgs(['foo.json', '--types=node', 'tsx', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      types: ['node', 'tsx'],
      isTestingCLI: true,
    },
  })
})

test('program w/ include option', () => {
  const result = parseArgs(['foo.json', '--include', 'foo', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      include: ['foo'],
      isTestingCLI: true,
    },
  })
})

test('program w/ exclude option', () => {
  const result = parseArgs(['foo.json', '--exclude', 'foo', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      exclude: ['foo'],
      isTestingCLI: true,
    },
  })
})

test('program stops parsing options after separator', () => {
  const result = parseArgs(['--debug', '--', '--not-an-option', 'tsconfig.json'])
  assert.deepStrictEqual(result, {
    files: ['--not-an-option', 'tsconfig.json'],
    help: false,
    options: {
      debug: true,
    },
  })
})

test('program w/ debug option', () => {
  const result = parseArgs(['foo.json', '--debug', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      debug: true,
      isTestingCLI: true,
    },
  })
})

test('program reports help without parsing other options', () => {
  const result = parseArgs(['--help', 'foo.json'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: true,
    options: {},
  })
})

test('program w/ out option', () => {
  const result = parseArgs(['foo.json', '--out', 'foo.json', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      out: 'foo.json',
      isTestingCLI: true,
    },
  })
})

test('program throws on unknown option', () => {
  assert.throws(() => parseArgs(['--wat']), /Unknown option: --wat/)
})

test('program throws on missing string option value', () => {
  assert.throws(() => parseArgs(['--module', '--isTestingCLI']), /Missing value for option: --module/)
})

test('program w/ path option', () => {
  const result = parseArgs(['foo.json', '--path', '{"item/*": ["foo": "bar"]}', '--isTestingCLI'])
  assert.deepStrictEqual(result, {
    files: ['foo.json'],
    help: false,
    options: {
      path: '{"item/*": ["foo": "bar"]}',
      isTestingCLI: true,
    },
  })
})
