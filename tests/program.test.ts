import { test, expect } from 'vitest'
import { parseArgs } from '../src/program.js'

test('program w/ file', () => {
  const result = parseArgs(['foo.json', '--isTestingCLI'])
  expect(result).toStrictEqual({
    files: ['foo.json'],
    help: false,
    options: {
      isTestingCLI: true,
    },
  })
})

test('program w/ files', () => {
  const result = parseArgs(['foo.json', 'bar.json', '--isTestingCLI'])
  expect(result).toStrictEqual({
    files: ['foo.json', 'bar.json'],
    help: false,
    options: {
      isTestingCLI: true,
    },
  })
})

test('program w/ boolean compiler option', () => {
  const result = parseArgs(['foo.json', '--allowJs', '--isTestingCLI'])
  expect(result).toStrictEqual({
    files: ['foo.json'],
    help: false,
    options: {
      allowJs: true,
      isTestingCLI: true,
    },
  })
})

test('program w/ deleted boolean compiler option', () => {
  const result = parseArgs(['foo.json', '--allowJs', 'delete', '--isTestingCLI'])
  expect(result).toStrictEqual({
    files: ['foo.json'],
    help: false,
    options: {
      allowJs: 'delete',
      isTestingCLI: true,
    },
  })
})

test('program w/ string compiler option', () => {
  const result = parseArgs(['foo.json', '--module', 'node', '--isTestingCLI'])
  expect(result).toStrictEqual({
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
  expect(result).toStrictEqual({
    files: ['foo.json'],
    help: false,
    options: {
      lib: ['foo', 'bar'],
      isTestingCLI: true,
    },
  })
})

test('program w/ include option', () => {
  const result = parseArgs(['foo.json', '--include', 'foo', '--isTestingCLI'])
  expect(result).toStrictEqual({
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
  expect(result).toStrictEqual({
    files: ['foo.json'],
    help: false,
    options: {
      exclude: ['foo'],
      isTestingCLI: true,
    },
  })
})

test('program w/ debug option', () => {
  const result = parseArgs(['foo.json', '--debug', '--isTestingCLI'])
  expect(result).toStrictEqual({
    files: ['foo.json'],
    help: false,
    options: {
      debug: true,
      isTestingCLI: true,
    },
  })
})

test('program w/ out option', () => {
  const result = parseArgs(['foo.json', '--out', 'foo.json', '--isTestingCLI'])
  expect(result).toStrictEqual({
    files: ['foo.json'],
    help: false,
    options: {
      out: 'foo.json',
      isTestingCLI: true,
    },
  })
})

test('program w/ path option', () => {
  const result = parseArgs(['foo.json', '--path', '{"item/*": ["foo": "bar"]}', '--isTestingCLI'])
  expect(result).toStrictEqual({
    files: ['foo.json'],
    help: false,
    options: {
      path: '{"item/*": ["foo": "bar"]}',
      isTestingCLI: true,
    },
  })
})
