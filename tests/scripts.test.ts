import { test, expect, vi } from "vitest";
import * as scripts from '../src/scripts';

const {
  logger,
  mergeConfigContent,
  mergeTsConfigs,
  resolveJSON,
  writeTsconfig
} = scripts;

test('logger', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
  logger({ isDebugging: false })("error")("foo")("bar")(new Error("baz"));
  expect(spy).toHaveBeenCalled();
})

test('mergeConfigContent for override sibling', () => {
  vi.clearAllMocks();
  vi.resetAllMocks();
  const json = mergeConfigContent(['./tests/cfg1.json', './tests/cfg2.json']);
  expect(json).toEqual({
    "compilerOptions": {
      "target": "commonjs",
    }
  });
});
