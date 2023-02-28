#!/usr/bin/env node
import { program } from 'commander'
import { logger, script } from './scripts'
import { Options } from './interfaces'
import { compilerOptions } from './config'


/**
 * action
 * @description run the scripts
 * @param Options
 * @returns  void
 */
export function action(files: string[], options: Options = {}): void {

  try {
    // capture/test CLI options
    const {
      debug = false,
      exclude,
      include,
      isTesting = false,
      isTestingCLI = false,
      out,
      path,
      ...compilerOptions
    } = options
    if (isTestingCLI) {
      console.info({ files, options })
      return
    }
    script({ debug, exclude, include, isTesting, path, out, tsconfigs: files, compilerOptions })
  } catch (err) {
    logger({ isDebugging: options.debug })('error')('action')('There was an error:')(err as unknown)
  }
}

/**
 * @description add initial program options
 */
program.name('merge-tsconfigs')
  .description(
    'Merge-tsconfigs is a CLI and node tool for merging tsconfig files into the exact tsconfig file you want 🛣️',
  )
  .argument('[files...]', 'files to check, matches an array pattern')
  .option('-d, --debug', 'enable debugging')
  .option('-e, --exclude [exclude...]', 'files to exclude, matches a glob or array pattern')
  .option('-i, --include [include...]', 'files to include, matches a glob or array pattern')
  .option('--isTesting', 'enable testing')
  .option('-o, --out <file>', 'output file, otherwise, the file will be written to tsconfig.merged.json')
  .option('--isTesting', 'enable testing')
  .option('-t, --isTestingCLI', 'enable CLI only testing')
  .option('-p, --path <path>', 'a json parseable string wrapped object, e.g. {"item/*": ["foo": "bar"]}')

/**
 * @description add dynamic program options for tsconfig.compilerOptions
 */
Object.keys(compilerOptions)
  .map((name) => ({ name, value: compilerOptions[name as keyof unknown] }))
  .forEach(({ name, value }) => {
    if (value === 'boolean') {
      program.option(`--${name}`, `tsconfig.compilerOptions.${name}`)
    } else if (value === 'string') {
      program.option(`--${name} <${value}>`, `tsconfig.compilerOptions.${name}`)
    } else if (value === 'array') {
      program.option(`--${name} [${value}...]`, `tsconfig.compilerOptions.${name}`)
    } else if (value === 'object') {
      program.option(`--${name} <${value}>`, `tsconfig.compilerOptions.${name}`)
    }
  })


/**
 * @description add program action and parse its args
 */
program
  .action(action)
  .parse(process.argv)

export default program
