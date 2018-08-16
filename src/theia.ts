import * as path from 'path'
import Builder from './Builder'
import Core, * as CoreHooks from './Core'
import DefaultBuilder from './DefaultBuilder'
import LocalStorage from './LocalStorage'
import Plugin from './Plugin'
import AuthPlugin from './plugins/AuthPlugin'
import BuildPlugin from './plugins/BuildPlugin'
import CachePlugin from './plugins/CachePlugin'
import ExpressPlugin from './plugins/ExpressPlugin'
import HeartbeatPlugin from './plugins/HeartbeatPlugin'
import InvalidateBuildManifestCachePlugin from './plugins/InvalidateBuildManifestCachePlugin'
import RollbarPlugin from './plugins/RollbarPlugin'
import SlackPlugin from './plugins/SlackPlugin'
import SourceMapSupportPlugin from './plugins/SourceMapSupportPlugin'
import UsagePlugin from './plugins/UsagePlugin'
import WendigoPlugin from './plugins/WendigoPlugin'
import S3Storage from './S3Storage'
import Storage from './Storage'

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

  for (const componentLibrary in opts.libs) {
    const componentLibConfig = opts.libs[componentLibrary]
    componentLibConfig.env = componentLibConfig.env || {}
    componentLibConfig.env.development = componentLibConfig.env.development || 'dev'
    componentLibConfig.env.production = componentLibConfig.env.production || 'master'
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
  CachePlugin,
  Core,
  CoreHooks,
  ExpressPlugin,
  HeartbeatPlugin,
  InvalidateBuildManifestCachePlugin,
  LocalStorage,
  Plugin,
  RollbarPlugin,
  S3Storage,
  SlackPlugin,
  SourceMapSupportPlugin,
  Storage,
  UsagePlugin,
  WendigoPlugin
}

export type Environment = 'test' | 'development' | 'production'

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
  env?: {
    [env: string]: string
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
  react: string
  reactDOMServer: string
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
