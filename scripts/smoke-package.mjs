#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readPackTarball } from './read-pack-tarball.mjs'

const packageName = 'merge-tsconfigs'
const defaultManagers = ['npm', 'pnpm', 'bun']

const parseArgs = (argv) =>
  argv.reduce(
    (acc, value, index) => {
      if (value === '--pack') {
        return { ...acc, pack: true }
      }

      if (value === '--keep') {
        return { ...acc, keep: true }
      }

      if (value === '--manager') {
        return { ...acc, managers: [argv[index + 1]] }
      }

      if (value.startsWith('--manager=')) {
        return { ...acc, managers: [value.slice('--manager='.length)] }
      }

      if (argv[index - 1] === '--manager' || value.startsWith('--')) {
        return acc
      }

      return { ...acc, packageSpec: value }
    },
    { keep: false, managers: defaultManagers, pack: false, packageSpec: undefined },
  )

const run = (command, args, options = {}) => {
  const cwd = options.cwd ?? process.cwd()
  const cacheDirectory = path.join(cwd, '.cache')
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      BUN_INSTALL_CACHE_DIR: path.join(cacheDirectory, 'bun'),
      CI: 'true',
      npm_config_cache: path.join(cacheDirectory, 'npm'),
      NPM_CONFIG_CACHE: path.join(cacheDirectory, 'npm'),
      XDG_CACHE_HOME: cacheDirectory,
    },
    input: options.input,
    stdio: options.input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        result.stdout ? `stdout:\n${result.stdout}` : '',
        result.stderr ? `stderr:\n${result.stderr}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    )
  }

  return result.stdout
}

const packPackage = () => {
  const output = run('pnpm', ['pack', '--json', '--pack-destination', './.npm-cache'], { cwd: process.cwd() })

  return readPackTarball(output)
}

const resolvePackageSpec = (packageSpec) => {
  if (!packageSpec) {
    throw new Error('usage: node scripts/smoke-package.mjs [--pack] [--manager <npm|pnpm|bun>] [package-spec]')
  }

  return fs.existsSync(packageSpec) ? path.resolve(packageSpec) : packageSpec
}

const writePackageJson = (directory) => {
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
  )
}

const installCommands = {
  bun: (packageSpec) => ['bun', ['add', '--dev', packageSpec]],
  npm: (packageSpec) => ['npm', ['install', '--save-dev', packageSpec]],
  pnpm: (packageSpec) => ['pnpm', ['add', '--save-dev', packageSpec]],
}

const installPackage = (manager, packageSpec, directory) => {
  const command = installCommands[manager]

  if (!command) {
    throw new Error(`Unsupported package manager: ${manager}`)
  }

  const [executable, args] = command(packageSpec)
  run(executable, args, { cwd: directory })
}

const writeTsconfigs = (directory) => {
  fs.writeFileSync(
    path.join(directory, 'tsconfig.base.json'),
    `${JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }, null, 2)}\n`,
  )
  fs.writeFileSync(
    path.join(directory, 'tsconfig.build.json'),
    `${JSON.stringify({ extends: './tsconfig.base.json', compilerOptions: { module: 'NodeNext' }, exclude: ['dist'] }, null, 2)}\n`,
  )
}

const verifyMergedTsconfig = (directory) => {
  const merged = JSON.parse(fs.readFileSync(path.join(directory, 'tsconfig.merged.json'), 'utf8'))

  if (merged.compilerOptions.strict !== true) {
    throw new Error('Expected strict option from extended config')
  }

  if (merged.compilerOptions.module !== 'NodeNext') {
    throw new Error('Expected module option from build config')
  }

  if (!merged.include.includes('src')) {
    throw new Error('Expected include from extended config')
  }

  if (!merged.exclude.includes('dist')) {
    throw new Error('Expected exclude from build config')
  }
}

const writeEsmCheck = (directory) => {
  fs.writeFileSync(
    path.join(directory, 'verify-esm.mjs'),
    `
import mergeTsConfigs from "${packageName}";
import * as mergeTsconfigs from "${packageName}";

if (typeof mergeTsConfigs !== "function") {
  throw new Error("Default ESM export is not a function");
}

if (typeof mergeTsconfigs.mergeTsConfigs !== "function") {
  throw new Error("Named ESM export mergeTsConfigs is not a function");
}
`.trimStart(),
  )
}

const writeCjsCheck = (directory) => {
  fs.writeFileSync(
    path.join(directory, 'verify-cjs.cjs'),
    `
const mergeTsConfigs = require("${packageName}");

if (typeof mergeTsConfigs.default !== "function") {
  throw new Error("Default CJS export is not a function");
}

if (typeof mergeTsConfigs.mergeTsConfigs !== "function") {
  throw new Error("Named CJS export mergeTsConfigs is not a function");
}
`.trimStart(),
  )
}

const verifyRuntimeImports = (manager, directory) => {
  writeEsmCheck(directory)
  writeCjsCheck(directory)

  run('node', ['verify-esm.mjs'], { cwd: directory })
  run('node', ['verify-cjs.cjs'], { cwd: directory })

  if (manager === 'bun') {
    run('bun', ['verify-esm.mjs'], { cwd: directory })
  }
}

const verifyCli = (manager, directory) => {
  writeTsconfigs(directory)

  const executable =
    manager === 'bun'
      ? ['bun', [path.join('node_modules', packageName, 'dist', 'program.js')]]
      : [path.join('node_modules', '.bin', packageName), []]

  const [command, commandArgs] = executable
  run(command, [...commandArgs, 'tsconfig.build.json', '--out', 'tsconfig.merged.json'], { cwd: directory })
  verifyMergedTsconfig(directory)
}

const smokePackage = (manager, packageSpec, options = {}) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `${packageName}-${manager}-`))

  try {
    writePackageJson(directory)
    installPackage(manager, packageSpec, directory)
    verifyRuntimeImports(manager, directory)
    verifyCli(manager, directory)
    console.info(`Package smoke passed for ${manager}`)
  } finally {
    if (!options.keep) {
      fs.rmSync(directory, { force: true, recursive: true })
    }
  }
}

const options = parseArgs(process.argv.slice(2))
const packageSpec = resolvePackageSpec(options.pack ? packPackage() : options.packageSpec)

options.managers.forEach((manager) => smokePackage(manager, packageSpec, { keep: options.keep }))
