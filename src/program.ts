#!/usr/bin/env node
import { program, Option } from 'commander'
import { logger, script } from './scripts'
import { Options } from './interfaces'
import { compilerOptions } from './config'


/**
 * action
 * @description run the scripts
 * @param Options
 * @returns  void
 */
export async function action(files: string[], options: Options = {}): Promise<void> {
  // capture/test CLI options
  const { debug = false, isTesting = false, isTestingCLI = false, ...compilerOptions } = options
  if (isTestingCLI) {
    console.info({ files })
    return
  }

  try {
    await script({ debug, tsconfigs: files, compilerOptions })
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
  .option('-o, --out <file>', 'output file, otherwise, the file will be written to tsconfig.merged.json')
  .option('-t, --isTestingCLI', 'enable CLI only testing')
  .option('-i, --include [include...]', 'files to include, matches a glob or array pattern')
  .option('-e, --exclude [exclude...]', 'files to exclude, matches a glob or array pattern')

/**
 * @description add dynamic program options for tsconfig.compilerOptions
 * TODO this data should be pulled from typescript dynamically
 */
Object.keys(compilerOptions)
  .map((name) => ({ name, value: compilerOptions[name as keyof unknown] }))
  .forEach(({ name, value }) => {
    if (['string', 'boolean'].includes(value)) {
      program.option(`--${name} <${value}>`, `tsconfig.compilerOptions.${name}`)
    } else if (value === 'array') {
      program.option(`--${name} [${value}...]`, `tsconfig.compilerOptions.${name}`)
    } else if (value === 'object') {
      console.info('object params are not supported. Reach out to the maintainer to implement this feature.')
    }
  })


/**
 * @description add program action and parse its args
 */
program
  .action(action)
  .parse(process.argv)

export default program
