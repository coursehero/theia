/* tslint:disable:no-eval */

import * as bluebird from 'bluebird'
import * as express from 'express'
import * as requireFromString from 'require-from-string'
import { log as _log, logError as _logError } from './Logger'
import { Builder, BuildLogStage, BuildManifest, BuildManifestEntry, ComponentLibrary, ComponentLibraryConfigurations, Configuration, Environment, RenderResult, RenderResultAssets, Stats, Storage } from './theia'
import { TypedAsyncParallelHook } from './TypedTapable'

export type OnBeforeRenderArgs = {
  core: Core
  req: express.Request
  componentLibrary: string
  component: string
  props: object
}

export type OnBuildTickArgs = {
  core: Core
  componentLibrary: string
  buildLog: BuildLogStage[]
}

export type OnComponentLibraryLoadArgs = {
  core: Core
  componentLibrary: string
  manifestEntry: BuildManifestEntry
}

export type OnComponentLibraryUpdateArgs = {
  core: Core
  componentLibrary: string
  manifestEntry: BuildManifestEntry
}

export type OnErrorArgs = {
  core: Core
  error: Error | string
}

export type OnExpressArgs = {
  core: Core
  app: express.Application
}

export type OnRenderArgs = OnBeforeRenderArgs

export type OnStartArgs = {
  core: Core
}

export type BeforeRenderHook = Tapable.ITypedAsyncParallelHook<OnBeforeRenderArgs>
export type BuildTickHook = Tapable.ITypedAsyncParallelHook<OnBuildTickArgs>
export type ComponentLibraryLoadHook = Tapable.ITypedAsyncParallelHook<OnComponentLibraryLoadArgs>
export type ComponentLibraryUpdateHook = Tapable.ITypedAsyncParallelHook<OnComponentLibraryUpdateArgs>
export type ErrorHook = Tapable.ITypedAsyncParallelHook<OnErrorArgs>
export type ExpressHook = Tapable.ITypedAsyncParallelHook<OnExpressArgs>
export type RenderHook = Tapable.ITypedAsyncParallelHook<OnRenderArgs>
export type StartHook = Tapable.ITypedAsyncParallelHook<OnStartArgs>

class Core {
  builder: Builder

  libs: ComponentLibraryConfigurations

  environment: Environment

  storage: Storage

  hooks: {
    beforeRender: BeforeRenderHook
    buildTick: BuildTickHook
    componentLibraryLoad: ComponentLibraryLoadHook
    componentLibraryUpdate: ComponentLibraryUpdateHook
    error: ErrorHook
    express: ExpressHook
    render: RenderHook
    start: StartHook
  } = {
    beforeRender: new TypedAsyncParallelHook(['core', 'req', 'componentLibrary', 'component', 'props']),
    buildTick: new TypedAsyncParallelHook(['core', 'componentLibrary', 'buildLog']),
    componentLibraryLoad: new TypedAsyncParallelHook(['core', 'componentLibrary', 'manifestEntry']),
    componentLibraryUpdate: new TypedAsyncParallelHook(['core', 'componentLibrary', 'manifestEntry']),
    error: new TypedAsyncParallelHook(['core', 'error']),
    express: new TypedAsyncParallelHook(['core', 'app']),
    render: new TypedAsyncParallelHook(['core', 'req', 'componentLibrary', 'component', 'props']),
    start: new TypedAsyncParallelHook(['core'])
  }

  libCache: { [key: string]: ComponentLibrary } = {}
  buildManifestCache: { [key: string]: BuildManifest } = {}
  statsContentsCache: { [key: string]: Stats } = {}

  constructor (public config: Required<Configuration>) {
    this.builder = config.builder
    this.libs = config.libs
    this.environment = config.environment
    this.storage = config.storage

    if (config.plugins) {
      for (const plugin of config.plugins) {
        plugin.apply(this)
      }
    }
  }

  start (): Promise<void> {
    return this.hooks.start.promise({ core: this }).catch(err => {
      // TODO: find out how to get which plugin threw the error
      const plugin = 'plugin'
      this.logError(`theia:${plugin}:start`, err)
    })
  }

  async render (req: express.Request, componentLibrary: string, componentName: string, props: object): Promise<RenderResult> {
    // don't wait for completion
    this.hooks.beforeRender.promise({ core: this, req, componentLibrary, component: componentName, props }).catch(err => {
      // TODO: find out how to get which plugin threw the error
      const plugin = 'plugin'
      this.logError(`theia:${plugin}:beforeRender`, err)
    })

    const componentLibraryObject = await this.getComponentLibrary(componentLibrary)
    if (!(componentName in componentLibraryObject.Components)) {
      throw new Error(`${componentName} is not a registered component of ${componentLibrary}`)
    }
    const React = componentLibraryObject.React
    const ReactDOMServer = componentLibraryObject.ReactDOMServer
    const Component = componentLibraryObject.Components[componentName]
    const html = ReactDOMServer.renderToString(React.createElement(Component, props))

    // TODO: code splitting w/ universal components
    const assets = await this.getAssets(componentLibrary, componentName)

    // don't wait for completion
    this.hooks.render.promise({ core: this, req, componentLibrary, component: componentName, props }).catch(err => {
      // TODO: find out how to get which plugin threw the error
      const plugin = 'plugin'
      this.logError(`theia:${plugin}:render`, err)
    })

    return {
      html,
      assets
    }
  }

  async registerComponentLibrary (componentLibrary: string, buildAssets: string[], manifestEntry: BuildManifestEntry): Promise<void> {
    for (const asset of buildAssets) {
      await this.storage.copy(componentLibrary, asset)
    }

    let manifest: BuildManifest = []
    if (await this.hasBuildManifest(componentLibrary)) {
      manifest = await this.getBuildManifest(componentLibrary)
    }

    manifest.push(manifestEntry)
    await this.hooks.componentLibraryUpdate.promise({ core: this, componentLibrary, manifestEntry }).catch(err => {
      // TODO: find out how to get which plugin threw the error
      const plugin = 'plugin'
      this.logError(`theia:${plugin}:componentLibraryUpdate`, err)
    })

    const manifestJson = JSON.stringify(manifest, null, 2)
    await this.storage.write(componentLibrary, 'build-manifest.json', manifestJson)

    delete this.libCache[componentLibrary]
    delete this.buildManifestCache[componentLibrary]
    delete this.statsContentsCache[componentLibrary]
  }

  hasBuildManifest (componentLibrary: string): Promise<boolean> {
    return this.storage.exists(componentLibrary, 'build-manifest.json')
  }

  async getBuildManifest (componentLibrary: string): Promise<BuildManifest> {
    if (this.buildManifestCache[componentLibrary]) {
      return this.buildManifestCache[componentLibrary]
    }

    const contents = await this.storage.load(componentLibrary, 'build-manifest.json')
    return this.buildManifestCache[componentLibrary] = JSON.parse(contents)
  }

  async getLatestStatsContents (componentLibrary: string): Promise<Stats> {
    if (this.statsContentsCache[componentLibrary]) {
      return this.statsContentsCache[componentLibrary]
    }

    const buildManifest = await this.getBuildManifest(componentLibrary)
    const latest = buildManifest[buildManifest.length - 1]
    const browserStatsContents = await this.storage.load(componentLibrary, latest.browserStats)
    const nodeStatsContents = await this.storage.load(componentLibrary, latest.nodeStats)
    return this.statsContentsCache[componentLibrary] = {
      browser: JSON.parse(browserStatsContents),
      node: JSON.parse(nodeStatsContents)
    }
  }

  async getComponentLibrary (componentLibrary: string): Promise<ComponentLibrary> {
    if (this.libCache[componentLibrary]) {
      return this.libCache[componentLibrary]
    }

    if (!await this.hasBuildManifest(componentLibrary)) {
      throw new Error(`${componentLibrary} is not a registered component library`)
    }

    const buildManifest = await this.getBuildManifest(componentLibrary)
    const latest = buildManifest[buildManifest.length - 1]
    const componentLibraryObject: ComponentLibrary = {
      React: requireFromString(await this.storage.load(componentLibrary, latest.react), `${componentLibrary}/${latest.react}`),
      ReactDOMServer: requireFromString(await this.storage.load(componentLibrary, latest.reactDOMServer), `${componentLibrary}/${latest.reactDOMServer}`),
      Components: {}
    }

    const stats = (await this.getLatestStatsContents(componentLibrary)).node
    for (const [componentName, componentAssets] of Object.entries(stats.assetsByChunkName)) {
      const componentBasename = componentAssets.find((asset: string) => asset.endsWith('.js'))
      const source = await this.storage.load(componentLibrary, componentBasename!)
      const Component = requireFromString(source, `${componentLibrary}/${componentBasename}`).default
      componentLibraryObject.Components[componentName] = Component
    }

    await this.hooks.componentLibraryLoad.promise({ core: this, componentLibrary, manifestEntry: latest }).catch(err => {
      // TODO: find out how to get which plugin threw the error
      const plugin = 'plugin'
      this.logError(`theia:${plugin}:componentLibraryLoad`, err)
    })

    return this.libCache[componentLibrary] = componentLibraryObject
  }

  // temporary. just returns all the assets for a CL. change when codesplitting is working
  async getAssets (componentLibrary: string, componentName: string): Promise<RenderResultAssets> {
    const stats = (await this.getLatestStatsContents(componentLibrary)).browser
    const assets = stats.assetsByChunkName[componentName]
    return {
      javascripts: assets.filter((asset: string) => asset.endsWith('.js')),
      stylesheets: assets.filter((asset: string) => asset.endsWith('.css'))
    }
  }

  async buildAll (): Promise<void> {
    this.log('theia:build-all', 'building component libraries ...')

    // purposefully serial - yarn has trouble running multiple processes
    return bluebird.each(Object.keys(this.libs), componentLibrary => {
      const componentLibraryConfig = this.libs[componentLibrary]
      return this.builder.build(this, componentLibrary, componentLibraryConfig)
    }).then(() => {
      this.log('theia:build-all', 'finished building component libraries')
    }).catch(err => {
      this.logError('theia:build-all', `error while building component libraries ${err}`)
    })
  }

  clearCache (componentLibrary?: string) {
    if (componentLibrary) {
      delete this.libCache[componentLibrary]
      delete this.buildManifestCache[componentLibrary]
      delete this.statsContentsCache[componentLibrary]
    } else {
      this.libCache = {}
      this.buildManifestCache = {}
      this.statsContentsCache = {}
    }
  }

  log (namespace: string, ...toLog: any[]) {
    _log(namespace, toLog.join())
  }

  logError (namespace: string, error: Error | string) {
    _logError(namespace, error)
    this.hooks.error.promise({ core: this, error }).catch(err => {
      _logError(namespace, `there was an error in the error handling hooks: ${err}`)
    })
  }
}

export default Core
