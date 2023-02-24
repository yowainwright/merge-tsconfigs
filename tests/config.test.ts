import { test, expect } from "vitest";
import { compilerOptions } from '../src/config'

test('compilerOptions', () => {
  const compilerOptionsKeys = Object.keys(compilerOptions)
  const compilerOptionsValues = Object.values(compilerOptions)
  expect(compilerOptionsKeys.length).toEqual(38)
  expect(compilerOptionsValues.filter(value => value == 'boolean').length).toEqual(23)
  expect(compilerOptionsValues.filter(value => value == 'array').length).toEqual(4)
  expect(compilerOptionsValues.filter(value => value == 'string').length).toEqual(10)
  expect(compilerOptionsValues.filter(value => value == 'object').length).toEqual(1)
});
