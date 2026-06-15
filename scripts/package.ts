#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

type PackageCommand = 'read-pack-tarball' | 'release' | 'release-tag' | 'smoke-package'

type StripAnsiState = {
  inAnsiSequence: boolean
  output: string
  skipCharacter: boolean
}

type PackedPackage = {
  filename: string
}

export type PackageManager = 'bun' | 'npm' | 'pnpm'

export type RunCommandOptions = {
  cwd?: string
  input?: string
}

export type RunCommand = (command: string, args: string[], options?: RunCommandOptions) => string

export type CommandResult = {
  status: number | null
  stderr: string
  stdout: string
}

export type ReleaseRunner = (command: string, args: readonly string[]) => CommandResult
export type ReleaseLogger = Pick<Console, 'log'>
export type PreRelease = 'alpha' | 'beta' | 'rc'
export type ReleaseIncrement = 'major' | 'minor' | 'patch'

export type ReleaseArgs = {
  dryRun: boolean
  increment?: ReleaseIncrement
  preRelease?: PreRelease
}

export type ReleaseOptions = {
  cwd?: string
  dryRun?: boolean
  increment?: ReleaseIncrement
  logger?: ReleaseLogger
  packageVersion?: string
  preRelease?: PreRelease
  runner?: ReleaseRunner
}

export type ReleaseTagOptions = {
  cwd?: string
  dryRun?: boolean
  logger?: ReleaseLogger
  requireUpstream?: boolean
  runner?: ReleaseRunner
  version?: string
}

export type ReleaseReadyOptions = {
  dryRun?: boolean
  requireUpstream?: boolean
}

export type ReleaseItArgsOptions = {
  increment?: ReleaseIncrement
  preRelease?: PreRelease
  version?: string
}

export type ReleasePlan = {
  commands: string[]
  steps: string[]
  tagName: string
  version: string
}

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

export type PackageCommandDependencies = SmokePackageDependencies & {
  cwd?: string
  packageVersion?: string
  releaseLogger?: ReleaseLogger
  releaseRunner?: ReleaseRunner
}

const packageName = 'merge-tsconfigs'
const packageCommands = new Set<string>(['read-pack-tarball', 'release', 'release-tag', 'smoke-package'])
const defaultManagers: PackageManager[] = ['npm', 'pnpm', 'bun']
const supportedManagers = new Set<string>(defaultManagers)
const preReleases = new Set<PreRelease>(['alpha', 'beta', 'rc'])
const releaseIncrements = new Set<ReleaseIncrement>(['major', 'minor', 'patch'])
const escapeCharacter = String.fromCharCode(27)
const controlSequenceIntroducer = String.fromCharCode(155)
const ansiFinalCodeMinimum = 0x40
const ansiFinalCodeMaximum = 0x7e
const versionPattern = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?/g
const stableVersionPattern = /^\d+\.\d+\.\d+$/
const safeShellArgPattern = /^[A-Za-z0-9_./:=@-]+$/

const isPackageCommand = (value: string | undefined): value is PackageCommand =>
  value !== undefined && packageCommands.has(value)

const readPackageCommand = (value: string | undefined): PackageCommand => {
  if (!isPackageCommand(value)) {
    throw new Error(`Unknown package command: ${value ?? ''}`)
  }

  return value
}

const isAnsiFinalCharacter = (character: string): boolean => {
  const code = character.charCodeAt(0)

  return code >= ansiFinalCodeMinimum && code <= ansiFinalCodeMaximum
}

const isPackedPackage = (value: unknown): value is PackedPackage =>
  typeof value === 'object' && value !== null && 'filename' in value && typeof value.filename === 'string'

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

const readReleaseIncrement = (value: string): ReleaseIncrement => {
  if (releaseIncrements.has(value as ReleaseIncrement)) {
    return value as ReleaseIncrement
  }

  throw new Error(`Invalid release increment: ${value}`)
}

const readPreRelease = (value: string): PreRelease => {
  if (preReleases.has(value as PreRelease)) {
    return value as PreRelease
  }

  throw new Error(`Invalid prerelease identifier: ${value}`)
}

export const parseReleaseArgs = (args: readonly string[]): ReleaseArgs => {
  const incrementFlag = args.find((arg) => arg.startsWith('--increment='))?.split('=')[1]
  const increment = incrementFlag
    ? readReleaseIncrement(incrementFlag)
    : (args.find((arg) => releaseIncrements.has(arg as ReleaseIncrement)) as ReleaseIncrement | undefined)
  const preReleaseValue = args.find((arg) => arg.startsWith('--preRelease='))?.split('=')[1]

  return {
    dryRun: args.includes('--dry-run'),
    ...(increment ? { increment } : {}),
    ...(preReleaseValue ? { preRelease: readPreRelease(preReleaseValue) } : {}),
  }
}

export const buildReleaseItArgs = ({ increment, preRelease, version }: ReleaseItArgsOptions): string[] => {
  const args = [
    '--git.tag=false',
    '--git.push=false',
    '--git.requireUpstream=false',
    '--git.getLatestTagFromAllRefs=true',
    '--ci',
  ]
  const releaseArgs = preRelease ? [`--preRelease=${preRelease}`, ...args] : args

  if (version) return [version, ...releaseArgs]
  if (increment) return [`--increment=${increment}`, ...releaseArgs]
  return releaseArgs
}

export const parseReleaseVersion = (output: string): string => {
  const version = output.match(versionPattern)?.at(-1)
  if (!version) throw new Error('Unable to resolve release version')
  return version
}

export const quoteShellArg = (arg: string): string => (safeShellArgPattern.test(arg) ? arg : JSON.stringify(arg))

export const formatShellCommand = (command: string, args: readonly string[]): string =>
  [command, ...args].map(quoteShellArg).join(' ')

export const formatTagName = (version: string): string => {
  if (!stableVersionPattern.test(version) && !/^\d+\.\d+\.\d+-[0-9A-Za-z.-]+(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid package version: ${version}`)
  }

  return `v${version}`
}

export const buildReleaseCommands = (version: string, releaseArgs: ReleaseArgs): string[] => {
  const tagName = formatTagName(version)

  return [
    formatShellCommand(
      './node_modules/.bin/release-it',
      buildReleaseItArgs({ preRelease: releaseArgs.preRelease, version }),
    ),
    formatShellCommand('git', ['tag', '--annotate', tagName, '--message', `Release ${version}`]),
    formatShellCommand('git', ['push', 'origin', `refs/tags/${tagName}`]),
  ]
}

export const buildReleasePlan = (version: string, releaseArgs: ReleaseArgs): ReleasePlan => {
  const tagName = formatTagName(version)

  return {
    commands: buildReleaseCommands(version, releaseArgs),
    steps: [
      'verify clean, up-to-date main',
      'create the release commit without pushing main',
      `push ${tagName} to trigger publishing`,
      'restore local main to its starting commit',
    ],
    tagName,
    version,
  }
}

export const buildCurrentVersionTagPlan = (version: string): ReleasePlan => {
  const tagName = formatTagName(version)

  return {
    commands: [
      formatShellCommand('git', ['tag', '--annotate', tagName, '--message', `Release ${version}`]),
      formatShellCommand('git', ['push', 'origin', `refs/tags/${tagName}`]),
    ],
    steps: ['verify clean, up-to-date main', `push ${tagName} to trigger publishing`],
    tagName,
    version,
  }
}

export const formatReleasePlan = (plan: ReleasePlan): string => {
  const steps = plan.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
  const commands = plan.commands.map((command, index) => `${index + 1}. ${command}`).join('\n')

  return [
    `Dry run release commands for ${plan.tagName}`,
    `Version: ${plan.version}`,
    '',
    'Steps:',
    steps,
    '',
    'Commands:',
    commands,
  ].join('\n')
}

export const createReleaseRunner =
  (cwd: string): ReleaseRunner =>
  (command, args) => {
    const result = spawnSync(command, Array.from(args), { cwd, encoding: 'utf8' })

    if (result.error) {
      throw result.error
    }

    return {
      status: result.status,
      stderr: result.stderr ?? '',
      stdout: result.stdout ?? '',
    }
  }

export const readPackageVersion = (cwd: string): string => {
  const manifest = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) as { version?: unknown }

  if (typeof manifest.version !== 'string') {
    throw new Error('package.json version is missing')
  }

  return manifest.version
}

export const releaseCommandText = (
  runner: ReleaseRunner,
  command: string,
  args: readonly string[],
  message = `${command} ${args.join(' ')} failed`,
): string => {
  const result = runner(command, args)

  if (result.status === 0) {
    return result.stdout.trim()
  }

  throw new Error(result.stderr.trim() || message)
}

const runReleaseStep = (runner: ReleaseRunner, command: string, args: readonly string[], message?: string): void => {
  releaseCommandText(runner, command, args, message)
}

export const isPreReleaseVersion = (version: string): boolean =>
  /^\d+\.\d+\.\d+-[0-9A-Za-z.-]+(?:\+[0-9A-Za-z.-]+)?$/.test(version)

export const isStableVersion = (version: string): boolean => stableVersionPattern.test(version)

export const normalizeReleaseOptions = (options: ReleaseOptions): ReleaseArgs => ({
  dryRun: options.dryRun ?? false,
  ...(options.increment ? { increment: options.increment } : {}),
  ...(options.preRelease ? { preRelease: options.preRelease } : {}),
})

export const assertMainReady = (runner: ReleaseRunner): string => {
  const branch = releaseCommandText(runner, 'git', ['branch', '--show-current'], 'Unable to read current branch')

  if (branch !== 'main') {
    throw new Error('Run releases from main')
  }

  const status = releaseCommandText(runner, 'git', ['status', '--short'], 'Unable to read working tree status')

  if (status) {
    throw new Error('Working tree must be clean before starting a release')
  }

  runReleaseStep(runner, 'git', ['fetch', 'origin', 'main', '--tags'], 'Unable to fetch origin/main')

  const head = releaseCommandText(runner, 'git', ['rev-parse', 'HEAD'], 'Unable to read HEAD')
  const upstream = releaseCommandText(runner, 'git', ['rev-parse', 'origin/main'], 'Unable to read origin/main')

  if (head !== upstream) {
    throw new Error('Local main must match origin/main before release')
  }

  return head
}

export const releaseTagExists = (runner: ReleaseRunner, tagName: string): boolean => {
  const localTag = runner('git', ['rev-parse', '-q', '--verify', `refs/tags/${tagName}`])
  const localTagError = localTag.stderr.trim()

  if (localTag.status !== 0 && localTagError) {
    throw new Error(localTagError)
  }

  if (localTag.status === 0) {
    return true
  }

  const remoteTag = runner('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tagName}`])

  if (remoteTag.status !== 0) {
    throw new Error(remoteTag.stderr.trim() || `Unable to check remote tag: ${tagName}`)
  }

  return remoteTag.stdout.trim().length > 0
}

export const assertReleaseTagMissing = (runner: ReleaseRunner, tagName: string): void => {
  if (releaseTagExists(runner, tagName)) {
    throw new Error(`Release tag already exists: ${tagName}`)
  }
}

export const assertReleaseTagAvailable = (runner: ReleaseRunner, version: string): void => {
  assertReleaseTagMissing(runner, formatTagName(version))
}

export const incrementPreReleaseVersion = (version: string, preRelease: PreRelease): string => {
  const match = version.match(/^(\d+\.\d+\.\d+)-([0-9A-Za-z.-]+)\.(\d+)(\+[0-9A-Za-z.-]+)?$/)

  if (!match || match[2] !== preRelease) {
    throw new Error(`Unable to advance ${preRelease} release version: ${version}`)
  }

  return `${match[1]}-${preRelease}.${Number(match[3]) + 1}${match[4] ?? ''}`
}

export const incrementStableVersion = (version: string, increment: ReleaseIncrement): string => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)

  if (!match) {
    throw new Error(`Unable to advance stable release version: ${version}`)
  }

  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])

  if (increment === 'major') {
    return `${major + 1}.0.0`
  }

  if (increment === 'minor') {
    return `${major}.${minor + 1}.0`
  }

  return `${major}.${minor}.${patch + 1}`
}

const buildVersionCandidates = (version: string, next: (candidate: string) => string): string[] =>
  Array.from({ length: 100 }).reduce<string[]>((candidates) => {
    const previous = candidates.at(-1)

    return [...candidates, previous ? next(previous) : version]
  }, [])

export const resolveAvailableReleaseVersion = (
  runner: ReleaseRunner,
  releaseArgs: ReleaseArgs,
  version: string,
): string => {
  if (!releaseArgs.preRelease) {
    if (!releaseArgs.increment) {
      throw new Error('Stable release resolution requires an explicit increment')
    }

    if (!isStableVersion(version)) {
      throw new Error(`release-it resolved a prerelease version for a stable release: ${version}`)
    }

    const stableVersion = buildVersionCandidates(version, (candidate) =>
      incrementStableVersion(candidate, releaseArgs.increment as ReleaseIncrement),
    ).find((candidate) => !releaseTagExists(runner, formatTagName(candidate)))

    if (stableVersion) {
      return stableVersion
    }

    throw new Error(`Unable to find an available release tag for ${version}`)
  }

  const preReleaseVersion = buildVersionCandidates(version, (candidate) =>
    incrementPreReleaseVersion(candidate, releaseArgs.preRelease as PreRelease),
  ).find((candidate) => !releaseTagExists(runner, formatTagName(candidate)))

  if (preReleaseVersion) {
    return preReleaseVersion
  }

  throw new Error(`Unable to find an available release tag for ${version}`)
}

export const resolveReleaseVersion = (runner: ReleaseRunner, releaseArgs: ReleaseArgs): string => {
  const output = releaseCommandText(runner, './node_modules/.bin/release-it', [
    '--release-version',
    ...buildReleaseItArgs(releaseArgs),
  ])
  const version = parseReleaseVersion(output)

  return resolveAvailableReleaseVersion(runner, releaseArgs, version)
}

export const createReleaseCommit = (runner: ReleaseRunner, releaseArgs: ReleaseArgs, version: string): void => {
  runReleaseStep(
    runner,
    './node_modules/.bin/release-it',
    buildReleaseItArgs({ preRelease: releaseArgs.preRelease, version }),
  )
}

export const restoreStartingHead = (runner: ReleaseRunner, startingHead: string): void => {
  runReleaseStep(runner, 'git', ['reset', '--hard', startingHead], 'Unable to restore the starting commit')
}

export const assertReleaseReady = (
  runner: ReleaseRunner,
  tagName: string,
  { dryRun = false, requireUpstream = true }: ReleaseReadyOptions = {},
): void => {
  const branch = releaseCommandText(runner, 'git', ['branch', '--show-current'], 'Unable to read current branch')

  if (branch !== 'main') {
    throw new Error('Release tags must be created from main')
  }

  const status = releaseCommandText(runner, 'git', ['status', '--short'], 'Unable to read working tree status')

  if (status) {
    throw new Error('Working tree must be clean before tagging a release')
  }

  if (!dryRun) {
    runReleaseStep(runner, 'git', ['fetch', 'origin', 'main', '--tags'], 'Unable to fetch origin/main')
  }

  if (requireUpstream) {
    const head = releaseCommandText(runner, 'git', ['rev-parse', 'HEAD'], 'Unable to read HEAD')
    const upstream = releaseCommandText(runner, 'git', ['rev-parse', 'origin/main'], 'Unable to read origin/main')

    if (head !== upstream) {
      throw new Error('Local main must match origin/main before tagging')
    }
  }

  assertReleaseTagMissing(runner, tagName)
}

export const runReleaseTag = ({
  cwd = process.cwd(),
  dryRun = false,
  logger = console,
  requireUpstream = true,
  runner = createReleaseRunner(cwd),
  version = readPackageVersion(cwd),
}: ReleaseTagOptions = {}): number => {
  const tagName = formatTagName(version)

  assertReleaseReady(runner, tagName, { dryRun, requireUpstream })

  if (dryRun) {
    logger.log(`Dry run: would create and push ${tagName}`)
    return 0
  }

  runReleaseStep(
    runner,
    'git',
    ['tag', '--annotate', tagName, '--message', `Release ${version}`],
    'Unable to create tag',
  )

  const push = runner('git', ['push', 'origin', `refs/tags/${tagName}`])

  if (push.status === 0) {
    logger.log(`Pushed ${tagName}`)
    return 0
  }

  runner('git', ['tag', '--delete', tagName])
  throw new Error(push.stderr.trim() || `Unable to push ${tagName}`)
}

export const runRelease = (options: ReleaseOptions = {}): number => {
  const cwd = options.cwd ?? process.cwd()
  const logger = options.logger ?? console
  const runner = options.runner ?? createReleaseRunner(cwd)
  const releaseArgs = normalizeReleaseOptions(options)
  const startingHead = assertMainReady(runner)
  const packageVersion = options.packageVersion ?? readPackageVersion(cwd)
  const shouldTagCurrentVersion =
    !releaseArgs.preRelease && !releaseArgs.increment && isPreReleaseVersion(packageVersion)

  if (shouldTagCurrentVersion) {
    if (releaseArgs.dryRun) {
      assertReleaseTagAvailable(runner, packageVersion)
      logger.log(formatReleasePlan(buildCurrentVersionTagPlan(packageVersion)))
      return 0
    }

    runReleaseTag({
      cwd,
      logger,
      requireUpstream: false,
      runner,
      version: packageVersion,
    })
    logger.log(`Tagged current package version ${packageVersion}.`)
    return 0
  }

  if (!releaseArgs.preRelease && !releaseArgs.increment) {
    throw new Error('Stable releases require an explicit increment: patch, minor, or major')
  }

  const version = resolveReleaseVersion(runner, releaseArgs)

  if (releaseArgs.dryRun) {
    logger.log(formatReleasePlan(buildReleasePlan(version, releaseArgs)))
    return 0
  }

  try {
    createReleaseCommit(runner, releaseArgs, version)
    runReleaseTag({
      cwd,
      logger,
      requireUpstream: false,
      runner,
      version,
    })
    logger.log('No PR was created and main was not pushed.')
    return 0
  } finally {
    restoreStartingHead(runner, startingHead)
  }
}

export const stripAnsi = (value: string): string => {
  const characters = Array.from(value)

  return characters.reduce<StripAnsiState>(
    (state, character, index) => {
      if (state.skipCharacter) {
        return { ...state, skipCharacter: false }
      }

      if (state.inAnsiSequence) {
        return { ...state, inAnsiSequence: !isAnsiFinalCharacter(character) }
      }

      if (character === escapeCharacter && characters[index + 1] === '[') {
        return { ...state, inAnsiSequence: true, skipCharacter: true }
      }

      if (character === controlSequenceIntroducer) {
        return { ...state, inAnsiSequence: true }
      }

      return { ...state, output: `${state.output}${character}` }
    },
    { inAnsiSequence: false, output: '', skipCharacter: false },
  ).output
}

export const findJsonStartIndexes = (text: string): number[] =>
  Array.from(text)
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => character === '[' || character === '{')
    .map(({ index }) => index)

export const findPackTarballInJson = (parsed: unknown): string | undefined => {
  const packages = Array.isArray(parsed) ? parsed : [parsed]

  return packages.find(isPackedPackage)?.filename
}

export const readPackTarballCandidate = (candidate: string): string | undefined => {
  try {
    return findPackTarballInJson(JSON.parse(candidate))
  } catch {
    return undefined
  }
}

export const readPackTarball = (output: string): string => {
  const text = stripAnsi(output)
  const tarball = findJsonStartIndexes(text).reduceRight<string | undefined>(
    (found, start) => found ?? readPackTarballCandidate(text.slice(start).trim()),
    undefined,
  )

  if (!tarball) {
    throw new Error('pack JSON output not found')
  }

  return tarball
}

export const readPackTarballFile = (filePath: string): string => readPackTarball(fs.readFileSync(filePath, 'utf8'))

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
      'usage: node --import tsx scripts/package.ts smoke-package [--pack] [--manager <npm|pnpm|bun>] [package-spec]',
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

export const runReadPackTarballCommand = (argv: string[], info: (message: string) => void = console.log): void => {
  const filePath = argv[0]

  if (!filePath) {
    throw new Error('usage: node --import tsx scripts/package.ts read-pack-tarball <npm-pack-json-file>')
  }

  info(readPackTarballFile(filePath))
}

export const parseReleaseTagArgs = (args: readonly string[]): { dryRun: boolean } => ({
  dryRun: args.includes('--dry-run'),
})

export const runReleaseCliCommand = (argv: string[], dependencies: PackageCommandDependencies = {}): void => {
  runRelease({
    ...parseReleaseArgs(argv),
    cwd: dependencies.cwd,
    logger: dependencies.releaseLogger,
    packageVersion: dependencies.packageVersion,
    runner: dependencies.releaseRunner,
  })
}

export const runReleaseTagCliCommand = (argv: string[], dependencies: PackageCommandDependencies = {}): void => {
  runReleaseTag({
    ...parseReleaseTagArgs(argv),
    cwd: dependencies.cwd,
    logger: dependencies.releaseLogger,
    runner: dependencies.releaseRunner,
    version: dependencies.packageVersion,
  })
}

export const runSmokePackageCommand = (argv: string[], dependencies: SmokePackageDependencies = {}): void => {
  const options = parseSmokePackageArgs(argv)
  const run = dependencies.runCommand ?? runCommand
  const packageSpec = resolvePackageSpec(options.pack ? packPackage(run) : options.packageSpec)

  options.managers.forEach((manager) =>
    smokePackage(manager, packageSpec, { ...dependencies, keep: options.keep, runCommand: run }),
  )
}

export const main = (argv = process.argv.slice(2), dependencies: PackageCommandDependencies = {}): void => {
  const [command, ...args] = argv
  const packageCommand = readPackageCommand(command)

  if (packageCommand === 'read-pack-tarball') {
    runReadPackTarballCommand(args)
    return
  }

  if (packageCommand === 'release') {
    runReleaseCliCommand(args, dependencies)
    return
  }

  if (packageCommand === 'release-tag') {
    runReleaseTagCliCommand(args, dependencies)
    return
  }

  runSmokePackageCommand(args, dependencies)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
