/// <reference path="../types/tapable.d.ts" />

import * as debug from 'debug'
import * as path from 'path'
import Builder from './Builder'
import Core, * as CoreHooks from './Core'
import DefaultBuilder from './DefaultBuilder'
import LocalStorage from './LocalStorage'
import Plugin from './Plugin'
import S3Storage from './S3Storage'
import Storage from './Storage'

// no nulls
export function nn<T> (array: (T | null)[]): T[] {
  return array.filter(e => e !== null) as T[]
}

function configDefaulter (options: Configuration): Required<Configuration> {
  const opts = Object.assign({}, options)

  if (opts.builder === undefined) {
    opts.builder = new DefaultBuilder()
  }

  if (opts.environment === undefined) {
    opts.environment = process.env.THEIA_ENV as Environment || 'development'
  }

  if (opts.gitDir === undefined) {
    opts.gitDir = path.join(require('app-root-path').toString(), 'var')
  }

  if (opts.libs === undefined) {
    throw new Error('must supply libs config')
  }

  for (const componentLibrary in opts.libs) {
    const componentLibConfig = opts.libs[componentLibrary]
    componentLibConfig.env = componentLibConfig.env || {}
    componentLibConfig.env.development = componentLibConfig.env.development || 'dev'
    componentLibConfig.env.production = componentLibConfig.env.production || 'master'
  }

  if (opts.plugins === undefined) {
    opts.plugins = []
  }

  if (opts.storage === undefined) {
    opts.storage = new LocalStorage(path.resolve(__dirname, '..', 'libs'))
  }

  if (opts.verbose === undefined) {
    opts.verbose = true
  }

  return opts as Required<Configuration>
}

export default function theia (configFromParams: Configuration, debugNamespaces: string): Core {
  debug.enable(debugNamespaces)

  const config = configDefaulter(configFromParams)
  const core = new Core(config)

  if (config.verbose) {
    core.log('theia', 'Version: ' + require('../package.json').version)
    core.log('theia', 'Libs: ' + JSON.stringify(config.libs, null, 2))
    core.log('theia', 'Plugins: ' + config.plugins.map(p => p.constructor.name).join(' '))
    core.log('theia', 'Storage: ' + config.storage.constructor.name)
  }

  return core
}

export {
  Builder,
  Core,
  CoreHooks,
  LocalStorage,
  Plugin,
  S3Storage,
  Storage
}

export type Environment = 'test' | 'development' | 'production'

export interface Configuration {
  builder?: Builder
  environment?: Environment
  libs?: ComponentLibraryConfigurations
  plugins?: Plugin[]
  storage?: Storage
  verbose?: boolean
  gitDir?: string
}

export interface ComponentLibraryConfigurations {
  [key: string]: ComponentLibraryConfiguration
}

export interface ComponentLibraryConfiguration {
  env?: {
    [env: string]: string
  }
  source: string
}

export interface BuildLogStage {
  name: string
  started: Date
  ended: Date | null
}

export interface BuildManifestEntry {
  author: {
    name: string
    email: string
  }
  commitHash: string
  commitMessage: string
  createdAt: string
  nodeStats: string
  browserStats: string
  react: string
  reactDOMServer: string
  success: boolean
}

export interface BuildManifest extends Array<BuildManifestEntry> {}

export interface ReactCacheEntry {
  React: any
  ReactDOMServer: any
}

export interface ComponentLibrary {
  React: any
  ReactDOMServer: any
  Components: {
    [key: string]: any // React.ComponentClass
  }
}

export interface RenderResult {
  html: string
  assets: RenderResultAssets
}

export interface RenderResultAssets {
  javascripts: string[]
  stylesheets: string[]
}

export interface Stats {
  browser: {
    assetsByChunkName: {
      [componentName: string]: string[]
    }
    assets: {
      name: string
    }[]
  }
  node: {
    assetsByChunkName: {
      [componentName: string]: string[]
    }
    assets: {
      name: string
    }[]
  }
}

export interface ResponseError extends Error {
  status?: number
}
