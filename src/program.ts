#!/usr/bin/env node
import { program, Option } from 'commander'
import { logger, script } from './scripts'
import { Options } from './interfaces'
import { defaultTsconfig } from './config'


/**
 * action
 * @description run the scripts
 * @param Options
 * @returns  void
 */
export async function action({ isTestingCLI, ...options }: Options = {}): Promise<void> {
  // capture/test CLI options
  if (isTestingCLI) {
    console.info({ options })
    return
  }

  try {
    await script(options)
  } catch (err) {
    logger({ isDebugging: options.debug })('error')('action')('There was an error:')(err as unknown)
  }
}

/**
 * @description add initial program options
 */
program.name('merge-tsconfigs')
  .description(
    'Codependency, for code dependency. Checks `coDependencies` in package.json files to ensure dependencies are up-to-date',
  )
  .argument('[files...]', 'files to check')
  .option('-t, --isTestingCLI', 'enable CLI only testing')
  .option('--isTesting', 'enable running fn tests w/o overwriting')
  .option('-i, --include [include...]', 'files to include')
  .option('-e, --exclude [exclude...]', 'files to exclude')

/**
 * @description add dynamic program options for tsconfig.compilerOptions
 * TODO this data should be pulled from typescript dynamically
 */
Object.keys(defaultTsconfig.compilerOptions)
  .map((item, i) => ({ name: [item], value: item[i] }))
  .forEach(({ name, value }) => {
    if (value === 'string' || value === 'boolean') {
      program.addOption(new Option(`--${name} <${value}>`, `tsconfig.compilerOptions.${name}`))
    } else if (value === 'array') {
      program.addOption(new Option(`--${name} [${value}...]`, `tsconfig.compilerOptions.${name}`))
    } else if (value === 'object') {
      console.info('object params are not supported. Reach ou to the maintainer to implement this feature.')
    }
  })


/**
 * @description add program action and parse its args
 */
program
  .action(action)
  .parse(process.argv)

export default program
