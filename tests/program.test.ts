import { promisify } from 'util'
import { exec } from "child_process";
import { test, expect } from "vitest";
import { stdoutToJSON } from "stdouttojson";

export const execPromise = promisify(exec)

test("program w/ file", async () => {
  const { stdout = '{}' } = await execPromise("tsx ./src/program.ts foo.json --isTestingCLI")
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json'],
    options: {
      isTestingCLI: "true",
    },
  })
})


test("program w/ files", async () => {
  const { stdout = '{}' } = await execPromise("tsx ./src/program.ts foo.json bar.json --isTestingCLI")
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json', 'bar.json'],
    options: {
      isTestingCLI: "true",
    },
  })
})

test("program w/ boolean compiler option", async () => {
  const { stdout = '{}' } = await execPromise("tsx ./src/program.ts foo.json --allowJs --isTestingCLI")
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json'],
    options: {
      allowJs: "true",
      isTestingCLI: "true",
    },
  })
})

test("program w/ string compiler option", async () => {
  const { stdout = '{}' } = await execPromise("tsx ./src/program.ts foo.json --module 'node' --isTestingCLI")
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json'],
    options: {
      module: "node",
      isTestingCLI: "true",
    },
  })
})

test("program w/ array compiler option", async () => {
  const { stdout = '{}' } = await execPromise("tsx ./src/program.ts foo.json --lib 'foo' 'bar' --isTestingCLI")
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json'],
    options: {
      lib: ["foo", "bar"],
      isTestingCLI: "true",
    },
  })
})

test("program w/ include option", async () => {
  const { stdout = '{}' } = await execPromise("tsx ./src/program.ts foo.json --include 'foo' --isTestingCLI")
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json'],
    options: {
      include: ["foo"],
      isTestingCLI: "true",
    },
  })
})

test("program w/ exclude option", async () => {
  const { stdout = '{}' } = await execPromise("tsx ./src/program.ts foo.json --exclude 'foo' --isTestingCLI")
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json'],
    options: {
      exclude: ["foo"],
      isTestingCLI: "true",
    },
  })
})

test("program w/ debug option", async () => {
  const { stdout = '{}' } = await execPromise("tsx ./src/program.ts foo.json --debug --isTestingCLI")
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json'],
    options: {
      debug: "true",
      isTestingCLI: "true",
    },
  })
})

test("program w/ out option", async () => {
  const { stdout = '{}' } = await execPromise("tsx ./src/program.ts foo.json --out 'foo.json' --isTestingCLI")
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json'],
    options: {
      out: "foo.json",
      isTestingCLI: "true",
    },
  })
})

test("program w/ path option", async () => {
  const { stdout = '{}' } = await execPromise("tsx ./src/program.ts foo.json --path '{\"item/*\": [\"foo\": \"bar\"]}' --isTestingCLI")
  expect(stdout).toContain('{"item/*": ["foo": "bar"]')
})
