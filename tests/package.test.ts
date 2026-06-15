import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  buildReleaseCommands,
  buildReleaseItArgs,
  formatReleasePlan,
  getCliCommand,
  getInstallCommand,
  incrementPreReleaseVersion,
  incrementStableVersion,
  isPreReleaseVersion,
  isStableVersion,
  main,
  packPackage,
  parseReleaseArgs,
  parseReleaseTagArgs,
  parseReleaseVersion,
  parseSmokePackageArgs,
  releaseTagExists,
  resolvePackageSpec,
  runRelease,
  runReadPackTarballCommand,
  runReleaseTag,
  smokePackage,
  verifyMergedTsconfig,
  type CommandResult,
  type ReleaseRunner,
  type RunCommand,
} from '../scripts/package.js'

const packOutputRun: RunCommand = () =>
  [
    '\u001B[34mCLI\u001B[39m Building entry: src/index.ts',
    JSON.stringify([{ filename: '.npm-cache/merge-tsconfigs-0.2.4.tgz' }]),
  ].join('\n')

const releaseItBaseArgs =
  '--git.tag=false --git.push=false --git.requireUpstream=false --git.getLatestTagFromAllRefs=true --ci'

const ok = (stdout = ''): CommandResult => ({ status: 0, stderr: '', stdout })
const fail = (stderr = 'failed', status = 1): CommandResult => ({ status, stderr, stdout: '' })

const createReleaseRunner = (
  responses: Record<string, CommandResult | ((command: string, args: readonly string[]) => CommandResult)>,
): { calls: string[][]; runner: ReleaseRunner } => {
  const calls: string[][] = []
  const runner: ReleaseRunner = (command, args) => {
    calls.push([command, ...args])

    const key = [command, ...args].join(' ')
    const response = responses[key]

    if (!response) {
      throw new Error(`Unexpected command: ${key}`)
    }

    return typeof response === 'function' ? response(command, args) : response
  }

  return { calls, runner }
}

const mainReadyResponses = (): Record<string, CommandResult> => ({
  'git branch --show-current': ok('main\n'),
  'git fetch origin main --tags': ok(),
  'git rev-parse HEAD': ok('abc123\n'),
  'git rev-parse origin/main': ok('abc123\n'),
  'git status --short': ok(),
})

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

test('runReadPackTarballCommand prints the tarball path', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-tsconfigs-pack-command-'))
  const packOutput = path.join(directory, 'npm-pack.json')
  const messages: string[] = []

  try {
    fs.writeFileSync(packOutput, packOutputRun('', []))
    runReadPackTarballCommand([packOutput], (message) => messages.push(message))

    assert.deepStrictEqual(messages, ['.npm-cache/merge-tsconfigs-0.2.4.tgz'])
  } finally {
    fs.rmSync(directory, { force: true, recursive: true })
  }
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

test('parseReleaseArgs reads release options', () => {
  assert.deepStrictEqual(parseReleaseArgs(['--increment=minor', '--preRelease=beta', '--dry-run']), {
    dryRun: true,
    increment: 'minor',
    preRelease: 'beta',
  })
  assert.deepStrictEqual(parseReleaseArgs(['patch']), {
    dryRun: false,
    increment: 'patch',
  })
})

test('parseReleaseArgs rejects invalid release options', () => {
  assert.throws(() => parseReleaseArgs(['--increment=nightly']), /Invalid release increment/)
  assert.throws(() => parseReleaseArgs(['--preRelease=nightly']), /Invalid prerelease identifier/)
})

test('parseReleaseTagArgs reads dry run mode', () => {
  assert.deepStrictEqual(parseReleaseTagArgs(['--dry-run']), { dryRun: true })
})

test('buildReleaseItArgs disables release-it tag and push side effects', () => {
  assert.deepStrictEqual(buildReleaseItArgs({ increment: 'patch' }), [
    '--increment=patch',
    '--git.tag=false',
    '--git.push=false',
    '--git.requireUpstream=false',
    '--git.getLatestTagFromAllRefs=true',
    '--ci',
  ])
  assert.deepStrictEqual(buildReleaseItArgs({ preRelease: 'beta', version: '1.2.4-beta.6' }), [
    '1.2.4-beta.6',
    '--preRelease=beta',
    '--git.tag=false',
    '--git.push=false',
    '--git.requireUpstream=false',
    '--git.getLatestTagFromAllRefs=true',
    '--ci',
  ])
})

test('parseReleaseVersion reads release-it output', () => {
  assert.equal(parseReleaseVersion("Let's release merge-tsconfigs (0.2.4...0.2.5-beta.6)"), '0.2.5-beta.6')
})

test('buildReleaseCommands returns the safe release commands', () => {
  assert.deepStrictEqual(buildReleaseCommands('0.2.5', { dryRun: true, increment: 'patch' }), [
    `./node_modules/.bin/release-it 0.2.5 ${releaseItBaseArgs}`,
    'git tag --annotate v0.2.5 --message "Release 0.2.5"',
    'git push origin refs/tags/v0.2.5',
  ])
})

test('formatReleasePlan prints the tag-only publish plan', () => {
  const plan = formatReleasePlan({
    commands: ['git push origin refs/tags/v0.2.5'],
    steps: ['verify clean, up-to-date main', 'push v0.2.5 to trigger publishing'],
    tagName: 'v0.2.5',
    version: '0.2.5',
  })

  assert.match(plan, /Dry run release commands for v0\.2\.5/)
  assert.match(plan, /git push origin refs\/tags\/v0\.2\.5/)
})

test('release version helpers advance stable and prerelease versions', () => {
  assert.equal(incrementStableVersion('1.2.3', 'patch'), '1.2.4')
  assert.equal(incrementStableVersion('1.2.3', 'minor'), '1.3.0')
  assert.equal(incrementStableVersion('1.2.3', 'major'), '2.0.0')
  assert.equal(incrementPreReleaseVersion('1.2.4-beta.6', 'beta'), '1.2.4-beta.7')
  assert.equal(isStableVersion('1.2.3'), true)
  assert.equal(isPreReleaseVersion('1.2.3-beta.1'), true)
})

test('releaseTagExists checks local and remote tags', () => {
  const { runner } = createReleaseRunner({
    'git ls-remote --tags origin refs/tags/v0.2.5': ok('remote refs/tags/v0.2.5\n'),
    'git rev-parse -q --verify refs/tags/v0.2.5': fail('', 1),
  })

  assert.equal(releaseTagExists(runner, 'v0.2.5'), true)
})

test('runRelease dry run validates main and reports the planned release', () => {
  const messages: string[] = []
  const { calls, runner } = createReleaseRunner({
    ...mainReadyResponses(),
    [`./node_modules/.bin/release-it --release-version --increment=patch ${releaseItBaseArgs}`]: ok(
      "Let's release merge-tsconfigs (0.2.4...0.2.5)\n",
    ),
    'git ls-remote --tags origin refs/tags/v0.2.5': ok(),
    'git rev-parse -q --verify refs/tags/v0.2.5': fail('', 1),
  })

  assert.equal(
    runRelease({
      dryRun: true,
      increment: 'patch',
      logger: { log: (message) => messages.push(message) },
      packageVersion: '0.2.4',
      runner,
    }),
    0,
  )

  assert.match(messages.join('\n'), /Dry run release commands for v0\.2\.5/)
  assert.equal(
    calls.some((call) => call.join(' ').startsWith('./node_modules/.bin/release-it 0.2.5')),
    false,
  )
})

test('runRelease rejects releases outside main', () => {
  const { runner } = createReleaseRunner({
    'git branch --show-current': ok('release-fix\n'),
  })

  assert.throws(() => runRelease({ dryRun: true, increment: 'patch', runner }), /Run releases from main/)
})

test('runRelease creates a local release commit, pushes only the release tag, and restores HEAD', () => {
  const messages: string[] = []
  const { calls, runner } = createReleaseRunner({
    ...mainReadyResponses(),
    [`./node_modules/.bin/release-it --release-version --increment=patch ${releaseItBaseArgs}`]: ok(
      "Let's release merge-tsconfigs (0.2.4...0.2.5)\n",
    ),
    [`./node_modules/.bin/release-it 0.2.5 ${releaseItBaseArgs}`]: ok(),
    'git ls-remote --tags origin refs/tags/v0.2.5': ok(),
    'git push origin refs/tags/v0.2.5': ok(),
    'git rev-parse -q --verify refs/tags/v0.2.5': fail('', 1),
    'git reset --hard abc123': ok(),
    'git tag --annotate v0.2.5 --message Release 0.2.5': ok(),
  })

  assert.equal(
    runRelease({
      increment: 'patch',
      logger: { log: (message) => messages.push(message) },
      packageVersion: '0.2.4',
      runner,
    }),
    0,
  )

  assert.equal(
    calls.some((call) => call.join(' ') === 'git push origin main'),
    false,
  )
  assert.equal(
    calls.some((call) => call.join(' ') === 'git push origin refs/tags/v0.2.5'),
    true,
  )
  assert.equal(
    calls.some((call) => call.join(' ') === 'git reset --hard abc123'),
    true,
  )
  assert.match(messages.join('\n'), /No PR was created and main was not pushed/)
})

test('runRelease dry run tags the current prerelease package version without release-it', () => {
  const messages: string[] = []
  const { calls, runner } = createReleaseRunner({
    ...mainReadyResponses(),
    'git ls-remote --tags origin refs/tags/v0.2.5-beta.1': ok(),
    'git rev-parse -q --verify refs/tags/v0.2.5-beta.1': fail('', 1),
  })

  assert.equal(
    runRelease({
      dryRun: true,
      logger: { log: (message) => messages.push(message) },
      packageVersion: '0.2.5-beta.1',
      runner,
    }),
    0,
  )

  assert.equal(
    calls.some((call) => call[0] === './node_modules/.bin/release-it'),
    false,
  )
  assert.match(messages.join('\n'), /Dry run release commands for v0\.2\.5-beta\.1/)
})

test('runRelease requires an explicit increment for stable versions', () => {
  const { runner } = createReleaseRunner(mainReadyResponses())

  assert.throws(
    () => runRelease({ dryRun: true, packageVersion: '0.2.4', runner }),
    /Stable releases require an explicit increment/,
  )
})

test('runReleaseTag dry run validates tag readiness', () => {
  const messages: string[] = []
  const { runner } = createReleaseRunner({
    'git branch --show-current': ok('main\n'),
    'git ls-remote --tags origin refs/tags/v0.2.4': ok(),
    'git rev-parse -q --verify refs/tags/v0.2.4': fail('', 1),
    'git rev-parse HEAD': ok('abc123\n'),
    'git rev-parse origin/main': ok('abc123\n'),
    'git status --short': ok(),
  })

  assert.equal(
    runReleaseTag({
      dryRun: true,
      logger: { log: (message) => messages.push(message) },
      runner,
      version: '0.2.4',
    }),
    0,
  )
  assert.deepStrictEqual(messages, ['Dry run: would create and push v0.2.4'])
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

test('main dispatches the smoke-package command', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-tsconfigs-main-'))
  const commands: string[] = []
  const run: RunCommand = (command, args, options = {}) => {
    commands.push([command, ...args].join(' '))

    if (command.endsWith(path.join('node_modules', '.bin', 'merge-tsconfigs'))) {
      writeMergedTsconfig(options.cwd ?? directory)
    }

    return ''
  }

  try {
    main(['smoke-package', 'merge-tsconfigs@1.2.3', '--manager', 'npm'], {
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

test('main dispatches the release command', () => {
  const messages: string[] = []
  const { runner } = createReleaseRunner({
    ...mainReadyResponses(),
    [`./node_modules/.bin/release-it --release-version --increment=patch ${releaseItBaseArgs}`]: ok(
      "Let's release merge-tsconfigs (0.2.4...0.2.5)\n",
    ),
    'git ls-remote --tags origin refs/tags/v0.2.5': ok(),
    'git rev-parse -q --verify refs/tags/v0.2.5': fail('', 1),
  })

  main(['release', '--increment=patch', '--dry-run'], {
    packageVersion: '0.2.4',
    releaseLogger: { log: (message) => messages.push(message) },
    releaseRunner: runner,
  })

  assert.match(messages.join('\n'), /Dry run release commands for v0\.2\.5/)
})
