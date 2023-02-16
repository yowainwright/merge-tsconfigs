#!/usr/bin/env node
import { program } from 'commander'
import { logger, script } from './scripts'
import { Options } from './interfaces'

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

program.name('merge-tsconfigs')
  .description(
    'Codependency, for code dependency. Checks `coDependencies` in package.json files to ensure dependencies are up-to-date',
  )
  .argument('[files...]', 'files to check')
  .option('-t, --isTestingCLI', 'enable CLI only testing')
  .option('--isTesting', 'enable running fn tests w/o overwriting')

export default program
