import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CompilerOptions } from 'typescript'
import type { LoggerParams, ConfigOptions, TsConfig, PartialCompilerOptions } from './interfaces.js'

/**
 * logger
 * @description logs to console messages
 * @param {LoggerParams.isDebugging} boolean
 * @param {LoggerParams.emoji} string
 * @param {LoggerParams.gap} string
 * @returns {void}
 */
export const logger =
  ({ isDebugging = false, emoji = `🛣️`, gap = ` => `, name = 'merge-tsconfigs' }: LoggerParams) =>
  (type: string) =>
  (section: string) =>
  (message: string) =>
  (err: unknown) => {
    const debugMsg = isDebugging ? 'debugging:' : ''
    const sectionMsg = section.length ? `${section}:` : ''
    const firstLine = `${name}:${debugMsg}${sectionMsg}`
    const secondLine = message ? `${emoji}${gap}${message}` : ''
    if (type === 'error') {
      console.error(firstLine)
      if (secondLine) console.error(secondLine)
      if (err) console.error(err)
    } else if (type === 'debug') {
      console.debug(firstLine)
      if (secondLine) console.debug(secondLine)
    } else if (type === 'info') {
      console.info(firstLine)
      if (secondLine) console.info(secondLine)
    } else {
      console.log(firstLine)
      if (secondLine) console.log(secondLine)
    }
  }

export function stripJsonComments(source: string): string {
  let output = ''
  let inString = false
  let isEscaped = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const nextChar = source[index + 1]

    if (inString) {
      output += char
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      output += char
      continue
    }

    if (char === '/' && nextChar === '/') {
      while (index < source.length && source[index] !== '\n') index += 1
      output += '\n'
      continue
    }

    if (char === '/' && nextChar === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') output += '\n'
        index += 1
      }
      index += 1
      continue
    }

    output += char
  }

  return output
}

export function stripTrailingCommas(source: string): string {
  let output = ''
  let inString = false
  let isEscaped = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      output += char
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      output += char
      continue
    }

    if (char === ',') {
      let nextIndex = index + 1
      while (/\s/.test(source[nextIndex] || '')) nextIndex += 1
      if (source[nextIndex] === '}' || source[nextIndex] === ']') continue
    }

    output += char
  }

  return output
}

export function parseJson<T>(source: string): T {
  return JSON.parse(stripTrailingCommas(stripJsonComments(source.trim()))) as T
}

/**
 * resolveJSON
 * @description resolves json from file
 * @param {path} string
 * @param {debug} boolean
 * @returns {*} json
 */
export function resolveJSON(path: string, debug = false): TsConfig {
  try {
    const json = parseJson<TsConfig>(readFileSync(path, 'utf8'))
    return json
  } catch (err) {
    if (debug) logger({ isDebugging: debug })('error')('resolveJSON')('There was an error:')(err as unknown)
    return {} as TsConfig
  }
}

/**
 * mergeConfigObjects
 * @description merges tsconfig objects
 * @param {tsconfig1} object
 * @param {tsconfig2} object
 * @returns {tsconfig} object
 */
export const mergeConfigObjects = (tsconfig1: TsConfig, tsconfig2: TsConfig) => ({
  ...tsconfig1,
  ...tsconfig2,
  compilerOptions: {
    ...tsconfig1?.compilerOptions,
    ...tsconfig2?.compilerOptions,
  },
  ...(tsconfig1?.exclude || tsconfig2?.exclude
    ? {
        exclude: [...(tsconfig1?.exclude || []), ...(tsconfig2?.exclude || [])],
      }
    : {}),
  ...(tsconfig1?.include || tsconfig2?.include
    ? {
        include: [...(tsconfig1?.include || []), ...(tsconfig2?.include || [])],
      }
    : {}),
})

/**
 * mergeConfigContent
 * @description merges tsconfig content
 * @param {tsconfigs} array
 * @param {debug} boolean
 * @returns {tsconfig} object
 */
export const mergeConfigContent = (tsconfigs: string[], cwd: string, debug = false) =>
  tsconfigs.reduce((acc: TsConfig = {}, tsconfig: string) => {
    const path = `${cwd}/${tsconfig}`
    let tsconfigJSON = resolveJSON(path, debug)
    const parentPath = tsconfigJSON?.extends
    if (parentPath) {
      const relativeParentPath = join(dirname(path), parentPath)
      const parentTsconfig = resolveJSON(relativeParentPath, debug)
      if (parentTsconfig?.extends) {
        logger({ isDebugging: debug })('error')('mergeConfigContent')(
          'Parent tsconfig:merge-tsconfigs only handles extending from a parent, consider extending tsconfigs less.',
        )(parentTsconfig)
      }

      const { extends: _, ...tsconfigWithoutExtends } = tsconfigJSON
      tsconfigJSON = mergeConfigObjects(parentTsconfig, tsconfigWithoutExtends)
    }
    if (!tsconfigJSON) {
      if (debug) logger({ isDebugging: debug })('error')('mergeConfigContent')('There was an error:')(tsconfigJSON)
      return acc
    }
    return mergeConfigObjects(acc, tsconfigJSON)
  }, {})

/**
 * writeTsconfig
 * @description writes tsconfig to file
 * @param {tsconfig} object
 * @param {out} string
 * @returns {tsconfig} object
 * @
 */
export const writeTsconfig = (tsconfig: TsConfig, cwd: string, out: string, isTesting: boolean) => {
  if (isTesting) return tsconfig
  const path = `${cwd}/${out}`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(tsconfig, null, 2))
  return tsconfig
}

/**
 * updateCompilerOptions
 * @description updates compilerOptions
 * @param {CompilerOptions} object
 * @param {CompilerOptions} object
 * @returns {CompilerOptions} object
 */
export const updateCompilerOptions = (
  compilerOptions: PartialCompilerOptions = {},
  currentCompilerOptions: PartialCompilerOptions = {},
  updatedPath: CompilerOptions['paths'] = {},
): PartialCompilerOptions => {
  const compilerOptionKeys = compilerOptions ? Object.keys(compilerOptions) : []
  const hasCompilerOptions = compilerOptionKeys.length > 0
  const hasUpdatedPath = Object.keys(updatedPath || {}).length > 0
  if (!hasCompilerOptions && !hasUpdatedPath) return {}

  const updatedOptions = compilerOptionKeys.reduce<PartialCompilerOptions>(
    (acc, key) => {
      const value = compilerOptions?.[key]
      if (value === 'delete') {
        const { [key]: _deletedOption, ...remainingOptions } = acc
        return remainingOptions
      }

      const parsedPath =
        key === 'paths' && typeof value === 'object' && value !== null && !Array.isArray(value)
          ? (value as CompilerOptions['paths'])
          : {}

      const paths = {
        ...((acc.paths || {}) as CompilerOptions['paths']),
        ...parsedPath,
      }

      return {
        ...acc,
        [key]: value,
        ...(Object.keys(paths).length > 0 ? { paths } : {}),
      }
    },
    { ...currentCompilerOptions },
  )

  if (hasUpdatedPath) {
    return {
      ...updatedOptions,
      paths: {
        ...((updatedOptions.paths || {}) as CompilerOptions['paths']),
        ...updatedPath,
      },
    }
  }

  return updatedOptions
}

/**
 * parsePath
 * @description parses a string wrapped object
 * @param {path} string
 * @param {debug} boolean
 * @returns {CompilerOptions.paths} object
 */
export const parsePath = (path = '', debug = false): CompilerOptions['paths'] => {
  if (!path) return {}
  try {
    const json = parseJson<CompilerOptions['paths']>(path)
    return json
  } catch (err) {
    if (debug) logger({ isDebugging: debug })('error')('parsePath')('There was an error:')(err as unknown)
    return {}
  }
}

/**
 * mergeConfigContent
 * @description merges tsconfig content
 * @param {tsconfigs} array
 * @param {CompilerOptions} object
 * @param {debug} boolean
 * @returns {tsconfig} object
 */
export const mergeTsConfigs = ({
  tsconfigs = [],
  exclude,
  include,
  compilerOptions,
  debug = false,
  out = 'tsconfig.merged.json',
  path,
  isTesting = false,
}: ConfigOptions) => {
  if (tsconfigs.length === 0) {
    if (debug) logger({ isDebugging: debug })('error')('mergeTsConfig')('No tsconfig files were provided.')(null)
    return
  }
  const cwd = process.cwd()
  const updatedTsconfig = mergeConfigContent(tsconfigs, cwd, debug)
  if (debug) logger({ isDebugging: debug })('debug')('mergeTsConfig')('Updated tsconfig:')(updatedTsconfig)

  const updatedPath = parsePath(path, debug)
  const updatedCompilerOptions = updateCompilerOptions(
    compilerOptions,
    updatedTsconfig?.compilerOptions || {},
    updatedPath,
  )
  const updatedExclude = exclude ? { exclude: [...(updatedTsconfig?.exclude || []), ...exclude] } : {}
  const updatedInclude = include ? { include: [...(updatedTsconfig.include || []), ...include] } : {}

  const tsconfig = {
    ...updatedTsconfig,
    ...updatedExclude,
    ...updatedInclude,
    ...(Object.keys(updatedCompilerOptions).length > 0 ? { compilerOptions: updatedCompilerOptions } : {}),
  }
  return writeTsconfig(tsconfig, cwd, out, isTesting)
}

export const script = mergeTsConfigs

export default mergeTsConfigs
