import { promisify } from 'util'
import { exec } from "child_process";
import { test, expect } from "vitest";
import { stdoutToJSON } from "stdouttojson";

export const execPromise = promisify(exec)

test("program w/ file", async () => {
  const { stdout = '{}' } = await execPromise("ts-node ./src/program.ts foo.json --isTestingCLI")
  console.log(stdout)
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json'],
  })
})


test("program w/ files", async () => {
  const { stdout = '{}' } = await execPromise("ts-node ./src/program.ts foo.json bar.json --isTestingCLI")
  const result = stdoutToJSON(stdout)
  expect(result).toStrictEqual({
    files: ['foo.json', 'bar.json'],
  })
})
