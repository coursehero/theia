#!/usr/bin/env node

import * as program from 'commander'
import * as path from 'path'
import makeCore, * as theia from './theia'

function load (configPath: string) {
  const ext = path.extname(configPath)
  if (ext === '.ts') {
    require('ts-node').register()
  }

  return require(path.resolve(process.cwd(), configPath)).default
}

function make () {
  const config = load(program.config) as Required<theia.Configuration>
  return makeCore(config, program.quiet ? '' : program.log)
}

program
  .version(require('../package.json').version)
  .option('-c, --config <path>', 'set config path', 'theia.config.js')
  .option('-l, --log <namespaces>', 'debug namespaces', 'theia*')
  .option('-q, --quiet', 'no output')

program
  .command('start')
  .description('start theia server')
  .action(function () {
    make().start().then(() => {
      console.log('starting Theia server')
    }).catch(e => {
      console.error(`error while starting Theia server: ${e}`)
    })
  })

program
  .command('build')
  .description('build all component libraries')
  .action(function () {
    make().buildAll().then(() => {
      console.log('finished building component libraries')
    }).catch(e => {
      console.error('error while building component libraries: ${e}')
    })
  })

program.parse(process.argv)
