import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { LoggerParams, ConfigOptions, TsConfig, PartialCompilerOptions } from './interfaces';

/**
 * logger
 * @description logs to console messages
 * @param {LoggerParams.isDebugging} boolean
 * @param {LoggerParams.emoji} string
 * @param {LoggerParams.gap} string
 * @returns {void}
 */
export const logger = ({ isDebugging = false, emoji = `🛣️`, gap = ` => `, name = 'merge-tsconfigs' }: LoggerParams) =>
  (type: string) => (section: string) => (message: string) => (err: unknown) => {
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

/**
 * resolveJSON
 * @description resolves json from file
 * @param {path} string
 * @param {debug} boolean
 * @returns {*} json
 */
export function resolveJSON(
  path: string,
  debug = false
): TsConfig {
  try {
    const json = JSON.parse(readFileSync(path, "utf8"));
    return json;
  } catch (err) {
    console.log({ err });
    if (debug)
      logger({ isDebugging: debug })("error")("resolveJSON")("There was an error:")(err as unknown);
    return {} as TsConfig;
  }
}

/**
 * mergeConfigContent
 * @description merges tsconfig content
 * @param {tsconfigs} array
 * @param {debug} boolean
 * @returns {tsconfig} object
 */
export const mergeConfigContent = (tsconfigs: string[], cwd: string, debug = false) => tsconfigs.reduce((acc: TsConfig = {}, tsconfig: string) => {
  const path = `${cwd}/${tsconfig}`
  let tsconfigJSON = resolveJSON(path, debug)
  const parentPath = tsconfigJSON?.extends
  if (parentPath) {
    const relativeParentPath = join(dirname(path), parentPath)
    const parentTsconfig = resolveJSON(relativeParentPath, debug)
    if (parentTsconfig?.extends) {
      logger({ isDebugging: debug })("error")("mergeConfigContent")("Parent tsconfig:merge-tsconfigs only handles extending from a parent, consider extending tsconfigs less.")(parentTsconfig)
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { extends: _, ...tsconfigWithoutExtends } = tsconfigJSON
    tsconfigJSON = {
      ...parentTsconfig,
      ...tsconfigWithoutExtends,
      compilerOptions: {
        ...parentTsconfig?.compilerOptions,
        ...tsconfigWithoutExtends?.compilerOptions,
      }
    }
  }
  if (!tsconfigJSON) {
    if (debug) logger({ isDebugging: debug })("error")("mergeConfigContent")("There was an error:")(tsconfigJSON);
    return acc
  }
  return {
    ...acc,
    ...tsconfigJSON,
    compilerOptions: {
      ...acc?.compilerOptions,
      ...tsconfigJSON?.compilerOptions,
    }
  }
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
  const path = out.length ? out : `${cwd}/tsconfig.merged.json`
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
 * TODO fix type issues below
 */
export const updateCompilerOptions = (compilerOptions: PartialCompilerOptions = {}, currentCompilerOptions: PartialCompilerOptions): PartialCompilerOptions => {
  const compilerOptionKeys = compilerOptions ? Object.keys(compilerOptions) : []
  const hasCompilerOptions = compilerOptionKeys.length > 0
  if (!hasCompilerOptions) return {}
  // delete compilerOptions
  return compilerOptionKeys.reduce((acc = {}, key) => {
    const updatedOptions = { ...acc, ...currentCompilerOptions }
    const value = compilerOptions?.[key] as string
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    if (updatedOptions?.[key] === 'delete') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore:next-line
      delete updatedOptions[key]
      return updatedOptions || {}
    }
    return { ...updatedOptions, [key]: value }
  }, {})
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
  out = '',
  isTesting = false,
}: ConfigOptions) => {
  if (tsconfigs.length === 0) {
    if (debug) logger({ isDebugging: debug })("error")("mergeTsConfig")("No tsconfig files were provided.")(null);
    return;
  }
  const cwd = process.cwd()
  const updatedTsconfig = mergeConfigContent(tsconfigs, cwd, debug)
  if (debug) logger({ isDebugging: debug })("debug")("mergeTsConfig")("Updated tsconfig:")(updatedTsconfig);

  const updatedCompilerOptions = updateCompilerOptions(compilerOptions, updatedTsconfig?.compilerOptions || {})
  const updatedExclude = exclude ? [...updatedTsconfig?.exclude || [], ...exclude] : updatedTsconfig?.exclude
  const updatedInclude = include ? [...updatedTsconfig.include || [], ...include] : updatedTsconfig?.include
  const tsconfig = {
    ...updatedTsconfig,
    ...updatedExclude,
    ...updatedInclude,
    ...(Object.keys(updatedCompilerOptions).length > 0 ? { compilerOptions: updatedCompilerOptions } : {})
  }
  return writeTsconfig(tsconfig, cwd, out, isTesting)
}

export const script = mergeTsConfigs

export default mergeTsConfigs
