import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

test('read-pack-tarball handles colored build logs before pnpm pack json', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-tsconfigs-pack-'))
  const packOutput = path.join(directory, 'npm-pack.json')

  fs.writeFileSync(
    packOutput,
    [
      '\u001B[34mCLI\u001B[39m Building entry: src/index.ts',
      '\u001B[32mCLI\u001B[39m Build success',
      JSON.stringify([{ filename: '.npm-cache/merge-tsconfigs-0.2.3.tgz' }]),
    ].join('\n'),
  )

  const tarball = execFileSync(process.execPath, ['scripts/read-pack-tarball.mjs', packOutput], {
    encoding: 'utf8',
  }).trim()

  assert.equal(tarball, '.npm-cache/merge-tsconfigs-0.2.3.tgz')
})
