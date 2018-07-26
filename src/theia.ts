import * as path from 'path'
import Builder from './builder'
import Core, * as CoreHooks from './core'
import DefaultBuilder from './default-builder'
import LocalStorage from './local-storage'
import Plugin from './plugin'
import AuthPlugin from './plugins/auth-plugin'
import BuildPlugin from './plugins/build-plugin'
import ExpressPlugin from './plugins/express-plugin'
import HeartbeatPlugin from './plugins/heartbeat-plugin'
import InvalidateBuildManifestCachePlugin from './plugins/invalidate-build-manifest-cache-plugin'
import ReheatCachePlugin from './plugins/reheat-cache-plugin'
import RollbarPlugin from './plugins/rollbar-plugin'
import SlackPlugin from './plugins/slack-plugin'
import UsagePlugin from './plugins/usage-plugin'
import S3Storage from './s3-storage'
import Storage from './storage'

// no nulls
export function nn<T> (array: (T | null)[]): T[] {
  return array.filter(e => e !== null) as T[]
}

function getConfig (configPath: string): Required<Configuration> {
  return require(configPath).default
}

function configDefaulter (options: Configuration): Required<Configuration> {
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

  if (opts.loadFromDisk === undefined) {
    opts.loadFromDisk = true
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
  CoreHooks,
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
  nodeStats: string
  browserStats: string
}

export interface BuildManifest extends Array<BuildManifestEntry> {}

export interface ReactComponentClass extends React.ComponentClass<object> {}

export interface ReactCacheEntry {
  React: any
  ReactDOM: any
  ReactDOMServer: any
}

export interface ComponentLibrary {
  React: any
  ReactDOM: any
  ReactDOMServer: any
  Components: {
    [key: string]: ReactComponentClass
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
  }
  node: {
    assetsByChunkName: {
      [componentName: string]: string[]
    }
  }
}

export interface ResponseError extends Error {
  status?: number
}
