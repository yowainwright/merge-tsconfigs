import { test, expect, vi } from "vitest";
import * as scripts from '../src/scripts';

const {
  logger,
  mergeConfigContent,
  mergeTsConfigs,
  resolveJSON,
  updateCompilerOptions,
  writeTsconfig
} = scripts;

test('logger', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
  logger({ isDebugging: false })("error")("foo")("bar")(new Error("baz"));
  expect(spy).toHaveBeenCalled();
})

test('resolveJSON', () => {
  const json = resolveJSON('./tests/cfg1.json', true);
  expect(json).toStrictEqual({
    "compilerOptions": {
      "target": "esnext",
    },
    "extends": "./cfg3.json",
  });
});

test('mergeConfigContent to override sibling', () => {
  const json = mergeConfigContent(['./tests/cfg1.json', './tests/cfg2.json'], process.cwd());
  expect(json).toEqual({
    "compilerOptions": {
      "target": "commonjs",
      "allowJS": true,
    }
  });
});

test('mergeConfigContent deeply extend the parent', () => {
  const json = mergeConfigContent(['./tests/cfg4.json', './tests/cfg2.json'], process.cwd());
  expect(json).toEqual({
    "compilerOptions": {
      "target": "commonjs",
      "rootDir": "src",
    }
  });
});

test('mergeConfigs', () => {
  const json = mergeTsConfigs({ tsconfigs: ['./tests/cfg1.json', './tests/cfg2.json'], isTesting: true });
  expect(json).toEqual({
    "compilerOptions": {
      "target": "commonjs",
      "allowJS": true,
    },
  });
})

test('writeTsconfig', () => {
  const json = writeTsconfig({ compilerOptions: { target: 'esnext' as keyof unknown } }, process.cwd(), './tmp/tsconfig.json', true);
  expect(json).toEqual({
    "compilerOptions": {
      "target": "esnext",
    },
  });
});

test('updateCompilerOptions delete compilerOptions', () => {
  const json = updateCompilerOptions({ target: 'esnext' as keyof unknown, allowJS: true }, { allowJS: 'delete' });
  expect(json).toEqual({ target: 'esnext' });
})
