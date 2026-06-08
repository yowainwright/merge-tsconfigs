import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compilerOptions } from '../src/config.js'

test('compilerOptions', () => {
  const compilerOptionsKeys = Object.keys(compilerOptions)
  const compilerOptionsValues = Object.values(compilerOptions)
  assert.equal(compilerOptionsKeys.length, 38)
  assert.equal(compilerOptionsValues.filter((value) => value == 'boolean').length, 23)
  assert.equal(compilerOptionsValues.filter((value) => value == 'array').length, 4)
  assert.equal(compilerOptionsValues.filter((value) => value == 'string').length, 10)
  assert.equal(compilerOptionsValues.filter((value) => value == 'object').length, 1)
})
