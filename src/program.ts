#!/usr/bin/env node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compilerOptions } from './config.js'
import type { Options } from './interfaces.js'
import { logger, script } from './scripts.js'

type OptionKind = 'array' | 'boolean' | 'object' | 'string'

type OptionDefinition = {
  aliases?: string[]
  description: string
  kind: OptionKind
  name: string
}

const baseOptions: OptionDefinition[] = [
  {
    aliases: ['-d'],
    description: 'enable debugging',
    kind: 'boolean',
    name: 'debug',
  },
  {
    aliases: ['-e'],
    description: 'files to exclude, matches a glob or array pattern',
    kind: 'array',
    name: 'exclude',
  },
  {
    aliases: ['-i'],
    description: 'files to include, matches a glob or array pattern',
    kind: 'array',
    name: 'include',
  },
  { description: 'enable testing', kind: 'boolean', name: 'isTesting' },
  {
    aliases: ['-t'],
    description: 'enable CLI only testing',
    kind: 'boolean',
    name: 'isTestingCLI',
  },
  {
    aliases: ['-o'],
    description: 'output file, otherwise, the file will be written to tsconfig.merged.json',
    kind: 'string',
    name: 'out',
  },
  {
    aliases: ['-p'],
    description: 'a json parseable string wrapped object, e.g. {"item/*": ["foo", "bar"]}',
    kind: 'string',
    name: 'path',
  },
]

const compilerOptionDefinitions = Object.entries(compilerOptions).map<OptionDefinition>(([name, kind]) => ({
  description: `tsconfig.compilerOptions.${name}`,
  kind,
  name,
}))

const optionDefinitions = [...baseOptions, ...compilerOptionDefinitions]

const optionMap = optionDefinitions.reduce<Map<string, OptionDefinition>>((acc, option) => {
  acc.set(`--${option.name}`, option)
  option.aliases?.forEach((alias) => acc.set(alias, option))
  return acc
}, new Map())

function isOptionToken(token: string | undefined): boolean {
  return Boolean(token?.startsWith('-'))
}

function isBooleanCompilerOption(name: string): boolean {
  return compilerOptions[name as keyof typeof compilerOptions] === 'boolean'
}

function parsePrimitiveValue(value: string): string | boolean {
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

function readOptionToken(token: string): { name: string; value?: string } {
  const [name, ...valueParts] = token.split('=')
  return {
    name,
    value: valueParts.length > 0 ? valueParts.join('=') : undefined,
  }
}

export function parseArgs(argv: string[]): {
  files: string[]
  help: boolean
  options: Options
} {
  const files: string[] = []
  const options: Options = {}
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--') {
      files.push(...argv.slice(index + 1))
      break
    }

    if (token === '-h' || token === '--help') {
      help = true
      continue
    }

    if (!isOptionToken(token)) {
      files.push(token)
      continue
    }

    const { name: optionToken, value: tokenValue } = readOptionToken(token)
    const option = optionMap.get(optionToken)
    if (!option) throw new Error(`Unknown option: ${optionToken}`)

    if (option.kind === 'boolean') {
      const nextValue = argv[index + 1]
      if (
        tokenValue === undefined &&
        isBooleanCompilerOption(option.name) &&
        nextValue &&
        !isOptionToken(nextValue) &&
        ['delete', 'false', 'true'].includes(nextValue)
      ) {
        options[option.name] = parsePrimitiveValue(nextValue)
        index += 1
      } else {
        options[option.name] = tokenValue === undefined ? true : parsePrimitiveValue(tokenValue)
      }
      continue
    }

    if (option.kind === 'array') {
      const values = tokenValue === undefined ? [] : [tokenValue]
      while (argv[index + 1] && !isOptionToken(argv[index + 1])) {
        values.push(argv[index + 1])
        index += 1
      }
      options[option.name] = values
      continue
    }

    const value = tokenValue ?? argv[index + 1]
    if (value === undefined || isOptionToken(value)) throw new Error(`Missing value for option: ${optionToken}`)
    options[option.name] = value
    if (tokenValue === undefined) index += 1
  }

  return { files, help, options }
}

/**
 * action
 * @description run the scripts
 * @param Options
 * @returns  void
 */
export function action(files: string[], options: Options = {}): void {
  try {
    const {
      debug = false,
      exclude,
      include,
      isTesting = false,
      isTestingCLI = false,
      out,
      path,
      ...compilerOptionOverrides
    } = options
    if (isTestingCLI) {
      console.info(JSON.stringify({ files, options }))
      return
    }
    script({
      debug,
      exclude,
      include,
      isTesting,
      path,
      out,
      tsconfigs: files,
      compilerOptions: compilerOptionOverrides,
    })
  } catch (err) {
    logger({ isDebugging: Boolean(options.debug) })('error')('action')('There was an error:')(err as unknown)
  }
}

export function createHelpText(): string {
  const lines = [
    'Usage: merge-tsconfigs [options] [files...]',
    '',
    'Merge-tsconfigs is a CLI and node tool for merging tsconfig files into the exact tsconfig file you want',
    '',
    'Arguments:',
    '  files                       files to check, matches an array pattern',
    '',
    'Options:',
  ]

  optionDefinitions.forEach((option) => {
    const aliases = option.aliases ? `${option.aliases.join(', ')}, ` : ''
    const valueHint =
      option.kind === 'array' ? ' [value...]' : option.kind === 'string' || option.kind === 'object' ? ' <value>' : ''
    lines.push(`  ${aliases}--${option.name}${valueHint}  ${option.description}`)
  })

  lines.push('  -h, --help  display help for command')

  return lines.join('\n')
}

export function runCli(argv = process.argv.slice(2)): void {
  try {
    const { files, help, options } = parseArgs(argv)
    if (help) {
      console.info(createHelpText())
      return
    }
    action(files, options)
  } catch (err) {
    logger({ isDebugging: true })('error')('program')('There was an error:')(err as unknown)
    process.exitCode = 1
  }
}

function isDirectRun(): boolean {
  if (!process.argv[1]) return false
  return fileURLToPath(import.meta.url) === resolve(process.argv[1])
}

if (isDirectRun()) runCli()

export default {
  action,
  createHelpText,
  parseArgs,
  runCli,
}
