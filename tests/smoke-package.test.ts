import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  getCliCommand,
  getInstallCommand,
  packPackage,
  parseSmokePackageArgs,
  resolvePackageSpec,
  smokePackage,
  verifyMergedTsconfig,
  type RunCommand,
} from '../scripts/smoke-package.js'

const packOutputRun: RunCommand = () =>
  [
    '\u001B[34mCLI\u001B[39m Building entry: src/index.ts',
    JSON.stringify([{ filename: '.npm-cache/merge-tsconfigs-0.2.4.tgz' }]),
  ].join('\n')

const writeMergedTsconfig = (directory: string): void => {
  fs.writeFileSync(
    path.join(directory, 'tsconfig.merged.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          strict: true,
        },
        exclude: ['dist'],
        include: ['src'],
      },
      null,
      2,
    )}\n`,
  )
}

test('parseSmokePackageArgs defaults to all package managers', () => {
  assert.deepStrictEqual(parseSmokePackageArgs(['--pack']), {
    keep: false,
    managers: ['npm', 'pnpm', 'bun'],
    pack: true,
  })
})

test('parseSmokePackageArgs accepts explicit package manager and package spec', () => {
  assert.deepStrictEqual(parseSmokePackageArgs(['merge-tsconfigs@1.2.3', '--manager', 'bun', '--keep']), {
    keep: true,
    managers: ['bun'],
    pack: false,
    packageSpec: 'merge-tsconfigs@1.2.3',
  })
})

test('parseSmokePackageArgs rejects unsupported package managers', () => {
  assert.throws(() => parseSmokePackageArgs(['--manager', 'yarn']), /Unsupported package manager: yarn/)
})

test('packPackage reads tarball path from pnpm pack output', () => {
  assert.equal(packPackage(packOutputRun), '.npm-cache/merge-tsconfigs-0.2.4.tgz')
})

test('resolvePackageSpec resolves local tarballs but leaves published specs alone', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-tsconfigs-spec-'))
  const tarball = path.join(directory, 'merge-tsconfigs.tgz')

  try {
    fs.writeFileSync(tarball, '')
    assert.equal(resolvePackageSpec(tarball), tarball)
    assert.equal(resolvePackageSpec('merge-tsconfigs@1.2.3'), 'merge-tsconfigs@1.2.3')
  } finally {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})

test('getInstallCommand maps package managers to install commands', () => {
  assert.deepStrictEqual(getInstallCommand('npm', 'merge-tsconfigs@1.2.3'), [
    'npm',
    ['install', '--save-dev', 'merge-tsconfigs@1.2.3'],
  ])
  assert.deepStrictEqual(getInstallCommand('pnpm', 'merge-tsconfigs@1.2.3'), [
    'pnpm',
    ['add', '--save-dev', 'merge-tsconfigs@1.2.3'],
  ])
  assert.deepStrictEqual(getInstallCommand('bun', 'merge-tsconfigs@1.2.3'), [
    'bun',
    ['add', '--dev', 'merge-tsconfigs@1.2.3'],
  ])
})

test('getCliCommand uses Bun for Bun CLI smoke', () => {
  assert.deepStrictEqual(getCliCommand('bun'), [
    'bun',
    [path.join('node_modules', 'merge-tsconfigs', 'dist', 'program.js')],
  ])
})

test('verifyMergedTsconfig accepts expected CLI output', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-tsconfigs-merged-'))

  try {
    writeMergedTsconfig(directory)
    assert.doesNotThrow(() => verifyMergedTsconfig(directory))
  } finally {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})

test('smokePackage installs, checks imports, and verifies CLI output', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-tsconfigs-smoke-'))
  const commands: string[] = []
  const run: RunCommand = (command, args, options = {}) => {
    commands.push([command, ...args].join(' '))

    if (command.endsWith(path.join('node_modules', '.bin', 'merge-tsconfigs'))) {
      writeMergedTsconfig(options.cwd ?? directory)
    }

    return ''
  }

  try {
    smokePackage('npm', 'merge-tsconfigs@1.2.3', {
      info: () => undefined,
      makeTempDirectory: () => directory,
      removeDirectory: () => undefined,
      runCommand: run,
    })

    assert.deepStrictEqual(commands, [
      'npm install --save-dev merge-tsconfigs@1.2.3',
      'node verify-esm.mjs',
      'node verify-cjs.cjs',
      `${path.join('node_modules', '.bin', 'merge-tsconfigs')} tsconfig.build.json --out tsconfig.merged.json`,
    ])
  } finally {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})
