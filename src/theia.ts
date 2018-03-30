import * as path from 'path'
import AuthPlugin from './plugins/auth-plugin'
import Builder from './builder'
import BuildPlugin from './plugins/build-plugin'
import Core from './core'
import DefaultBuilder from './default-builder'
import ExpressPlugin from './plugins/express-plugin'
import HeartbeatPlugin from './plugins/heartbeat-plugin'
import InvalidateBuildManifestCachePlugin from './plugins/invalidate-build-manifest-cache-plugin'
import LocalStorage from './local-storage'
import Plugin from './plugin'
import ReheatCachePlugin from './plugins/reheat-cache-plugin'
import RollbarPlugin from './plugins/rollbar-plugin'
import S3Storage from './s3-storage'
import SlackPlugin from './plugins/slack-plugin'
import Storage from './storage'
import UsagePlugin from './plugins/usage-plugin'

// no nulls
export function nn<T> (array: (T | null)[]): T[] {
  return array.filter(e => e !== null) as T[]
}

function getConfig (configPath: string): Configuration {
  return require(configPath).default
}

function configDefaulter (options: Configuration): CompleteConfiguration {
  const opts = Object.assign({}, options)

  if (opts.builder === undefined) {
    opts.builder = new DefaultBuilder()
  }

  if (opts.environment === undefined) {
    opts.environment = process.env.THEIA_ENV as Environment || 'development'
  }

  if (opts.libs === undefined) {
    throw new Error('must supply libs config')
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

  return opts as CompleteConfiguration
}

export default function theia (configFromParams?: Configuration): Core {
  const configPaths = [
    path.resolve('theia.config'),
    path.resolve('dist/theia.config'),
    path.resolve('src/theia.config')
  ]
  const configPath = configPaths.find(p => {
    try {
      require.resolve(p)
      return true
    } catch (e) {
      return false
    }
  })

  let config
  const readFromDisk = !configFromParams || (configFromParams && configFromParams.loadFromDisk)
  if (readFromDisk && configPath) {
    config = getConfig(configPath)
    // TODO merge configFromParams
  } else if (configFromParams) {
    config = configFromParams
  } else {
    throw new Error('could not find theia config')
  }

  config = configDefaulter(config)
  const core = new Core(config)

  if (config.verbose) {
    core.log('theia', 'Libs: ' + JSON.stringify(config.libs, null, 2))
    core.log('theia', 'Plugins: ' + config.plugins.map(p => p.constructor.name).join(' '))
    core.log('theia', 'Storage: ' + config.storage.constructor.name)
  }

  return core
}

export {
  AuthPlugin,
  Builder,
  BuildPlugin,
  Core,
  ExpressPlugin,
  HeartbeatPlugin,
  InvalidateBuildManifestCachePlugin,
  LocalStorage,
  Plugin,
  ReheatCachePlugin,
  RollbarPlugin,
  S3Storage,
  SlackPlugin,
  Storage,
  UsagePlugin
}

export type Environment = 'development' | 'production'

export interface Configuration {
  builder?: Builder
  environment?: Environment
  libs?: ComponentLibraryConfigurations
  plugins?: Plugin[]
  storage?: Storage
  verbose?: boolean
  loadFromDisk?: boolean
}

export interface CompleteConfiguration {
  builder: Builder
  environment: Environment
  libs: ComponentLibraryConfigurations
  plugins: Plugin[]
  storage: Storage
  verbose: boolean
}

export interface ComponentLibraryConfigurations {
  [key: string]: ComponentLibraryConfiguration
}

export interface ComponentLibraryConfiguration {
  branches: {
    development: string
    production: string
  }
  source: string
}

export interface BuildManifestEntry {
  author: {
    name: string
    email: string
  }
  commitHash: string
  commitMessage: string
  createdAt: string
  stats: string
}

export interface BuildManifest extends Array<BuildManifestEntry> {}

export interface ReactComponentClass extends React.ComponentClass<object> {}

export interface ReactCacheEntry {
  React: any
  ReactDOMServer: any
}

export interface ComponentLibrary {
  [key: string]: ReactComponentClass
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
  assetsByChunkName: {
    manifest: string[]
  }
}

export interface ResponseError extends Error {
  status?: number
}
