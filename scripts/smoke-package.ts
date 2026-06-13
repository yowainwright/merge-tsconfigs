#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { readPackTarball } from './read-pack-tarball.js'

export type PackageManager = 'bun' | 'npm' | 'pnpm'

export type RunCommandOptions = {
  cwd?: string
  input?: string
}

export type RunCommand = (command: string, args: string[], options?: RunCommandOptions) => string

export type SmokePackageOptions = {
  keep: boolean
  managers: PackageManager[]
  pack: boolean
  packageSpec?: string
}

type ParseState = {
  managerWasSet: boolean
  options: SmokePackageOptions
  skipNext: boolean
}

export type SmokePackageDependencies = {
  info?: (message: string) => void
  keep?: boolean
  makeTempDirectory?: (manager: PackageManager) => string
  removeDirectory?: (directory: string) => void
  runCommand?: RunCommand
}

const packageName = 'merge-tsconfigs'
const defaultManagers: PackageManager[] = ['npm', 'pnpm', 'bun']
const supportedManagers = new Set<string>(defaultManagers)

const isPackageManager = (value: string | undefined): value is PackageManager =>
  value !== undefined && supportedManagers.has(value)

const readPackageManager = (value: string | undefined): PackageManager => {
  if (!isPackageManager(value)) {
    throw new Error(`Unsupported package manager: ${value ?? ''}`)
  }

  return value
}

const addManager = (state: ParseState, manager: PackageManager): ParseState => ({
  ...state,
  managerWasSet: true,
  options: {
    ...state.options,
    managers: state.managerWasSet ? [...state.options.managers, manager] : [manager],
  },
})

export const parseSmokePackageArgs = (argv: string[]): SmokePackageOptions =>
  argv.reduce<ParseState>(
    (state, value, index) => {
      if (state.skipNext) {
        return { ...state, skipNext: false }
      }

      if (value === '--pack') {
        return { ...state, options: { ...state.options, pack: true } }
      }

      if (value === '--keep') {
        return { ...state, options: { ...state.options, keep: true } }
      }

      if (value === '--manager') {
        return { ...addManager(state, readPackageManager(argv[index + 1])), skipNext: true }
      }

      if (value.startsWith('--manager=')) {
        return addManager(state, readPackageManager(value.slice('--manager='.length)))
      }

      if (value.startsWith('--')) {
        throw new Error(`Unknown option: ${value}`)
      }

      return { ...state, options: { ...state.options, packageSpec: value } }
    },
    {
      managerWasSet: false,
      options: { keep: false, managers: defaultManagers, pack: false },
      skipNext: false,
    },
  ).options

export const runCommand: RunCommand = (command, args, options = {}) => {
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

export const packPackage = (run: RunCommand = runCommand): string => {
  const output = run('pnpm', ['pack', '--json', '--pack-destination', './.npm-cache'], { cwd: process.cwd() })

  return readPackTarball(output)
}

export const resolvePackageSpec = (packageSpec: string | undefined): string => {
  if (!packageSpec) {
    throw new Error(
      'usage: node --import tsx scripts/smoke-package.ts [--pack] [--manager <npm|pnpm|bun>] [package-spec]',
    )
  }

  return fs.existsSync(packageSpec) ? path.resolve(packageSpec) : packageSpec
}

export const writePackageJson = (directory: string): void => {
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`,
  )
}

export const getInstallCommand = (manager: PackageManager, packageSpec: string): [string, string[]] => {
  const installCommands: Record<PackageManager, [string, string[]]> = {
    bun: ['bun', ['add', '--dev', packageSpec]],
    npm: ['npm', ['install', '--save-dev', packageSpec]],
    pnpm: ['pnpm', ['add', '--save-dev', packageSpec]],
  }

  return installCommands[manager]
}

export const installPackage = (
  manager: PackageManager,
  packageSpec: string,
  directory: string,
  run: RunCommand = runCommand,
): void => {
  const [executable, args] = getInstallCommand(manager, packageSpec)

  run(executable, args, { cwd: directory })
}

export const writeTsconfigs = (directory: string): void => {
  fs.writeFileSync(
    path.join(directory, 'tsconfig.base.json'),
    `${JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }, null, 2)}\n`,
  )
  fs.writeFileSync(
    path.join(directory, 'tsconfig.build.json'),
    `${JSON.stringify({ extends: './tsconfig.base.json', compilerOptions: { module: 'NodeNext' }, exclude: ['dist'] }, null, 2)}\n`,
  )
}

export const verifyMergedTsconfig = (directory: string): void => {
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

export const writeEsmCheck = (directory: string): void => {
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

export const writeCjsCheck = (directory: string): void => {
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

export const verifyRuntimeImports = (
  manager: PackageManager,
  directory: string,
  run: RunCommand = runCommand,
): void => {
  writeEsmCheck(directory)
  writeCjsCheck(directory)

  run('node', ['verify-esm.mjs'], { cwd: directory })
  run('node', ['verify-cjs.cjs'], { cwd: directory })

  if (manager === 'bun') {
    run('bun', ['verify-esm.mjs'], { cwd: directory })
  }
}

export const getCliCommand = (manager: PackageManager): [string, string[]] =>
  manager === 'bun'
    ? ['bun', [path.join('node_modules', packageName, 'dist', 'program.js')]]
    : [path.join('node_modules', '.bin', packageName), []]

export const verifyCli = (manager: PackageManager, directory: string, run: RunCommand = runCommand): void => {
  writeTsconfigs(directory)

  const [command, commandArgs] = getCliCommand(manager)
  run(command, [...commandArgs, 'tsconfig.build.json', '--out', 'tsconfig.merged.json'], { cwd: directory })
  verifyMergedTsconfig(directory)
}

export const smokePackage = (
  manager: PackageManager,
  packageSpec: string,
  dependencies: SmokePackageDependencies = {},
): void => {
  const run = dependencies.runCommand ?? runCommand
  const directory =
    dependencies.makeTempDirectory?.(manager) ?? fs.mkdtempSync(path.join(os.tmpdir(), `${packageName}-${manager}-`))
  const removeDirectory =
    dependencies.removeDirectory ?? ((target: string) => fs.rmSync(target, { force: true, recursive: true }))
  const info = dependencies.info ?? console.info

  try {
    writePackageJson(directory)
    installPackage(manager, packageSpec, directory, run)
    verifyRuntimeImports(manager, directory, run)
    verifyCli(manager, directory, run)
    info(`Package smoke passed for ${manager}`)
  } finally {
    if (!dependencies.keep) {
      removeDirectory(directory)
    }
  }
}

export const main = (argv = process.argv.slice(2), dependencies: SmokePackageDependencies = {}): void => {
  const options = parseSmokePackageArgs(argv)
  const run = dependencies.runCommand ?? runCommand
  const packageSpec = resolvePackageSpec(options.pack ? packPackage(run) : options.packageSpec)

  options.managers.forEach((manager) =>
    smokePackage(manager, packageSpec, { ...dependencies, keep: options.keep, runCommand: run }),
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
