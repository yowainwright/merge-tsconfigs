// TODO add compilerOptions
// import { CompilerOptions } from 'typescript'
// import { createTypeScriptSandbox } from '@typescript/sandbox';
import { readFileSync } from 'fs'
import gradient from 'gradient-string'
import { LoggerParams, ConfigOptions, TsConfig } from './interfaces';

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
      console.error(gradient.passion(firstLine))
      if (secondLine) console.error(secondLine)
      if (err) console.error(err)
    } else if (type === 'debug') {
      console.debug(gradient.passion(firstLine))
      if (secondLine) console.debug(secondLine)
    } else if (type === 'info') {
      console.info(gradient.teen(firstLine))
      if (secondLine) console.info(secondLine)
    } else {
      console.log(gradient.teen(firstLine))
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
export const mergeConfigContent = (tsconfigs: string[], debug = false) => tsconfigs.reduce((acc: TsConfig = {}, tsconfig: string) => {
  let tsconfigJSON = resolveJSON(tsconfig, true)
  if (tsconfigJSON?.extends) {
    const parentTsconfig = resolveJSON(tsconfigJSON.extends as string, true)
    if (parentTsconfig?.extends) {
      logger({ isDebugging: false })("error")("mergeConfigContent")("Parent tsconfig:merge-tsconfigs only handles extending from a parent, consider extending tsconfigs less.")(parentTsconfig)
    }
    tsconfigJSON = {
      ...parentTsconfig,
      ...tsconfigJSON
    }
  }
  if (!tsconfigJSON) {
    if (debug) logger({ isDebugging: debug })("error")("mergeConfigContent")("There was an error:")(tsconfigJSON);
    return acc
  }
  return {
    ...acc,
    ...tsconfigJSON
  }
}, {})


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
  // TODO compilerOptions,
  // TODO isTesting,
  debug = false,
}: ConfigOptions) => {
  if (tsconfigs.length === 0) {
    if (debug) logger({ isDebugging: debug })("error")("mergeTsConfig")("No tsconfig files were provided.")(null);
    return;
  }
  const updatedTsconfig = mergeConfigContent(tsconfigs, debug)
  if (debug) logger({ isDebugging: debug })("debug")("mergeTsConfig")("Updated tsconfig:")(updatedTsconfig);
  return {
    ...updatedTsconfig,
    // TODO compilerOptions
  }
}

export const script = mergeTsConfigs

export default mergeTsConfigs
