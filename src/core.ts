/* tslint:disable:no-eval */

import * as bluebird from 'bluebird'
import * as express from 'express'
import * as rp from 'request-promise'
import { log as _log, logError as _logError } from './logger'
import { Storage, ReactComponentClass, BuildManifestEntry, RenderResult, RenderResultAssets, Stats, ComponentLibrary, BuildManifest, Builder, Environment, ReactCacheEntry, ComponentLibraryConfigurations, Configuration } from './theia'
import { TypedAsyncParallelHook } from './typed-tapable'

/*
  This loads the production bundle of React for a specified version, evaluates the code,
  and stores within a cache separate from other versions.

  This doesn't have to be dynamic, but this will enable multiple versions of React to be supported.
*/
const reactCache: { [key: string]: ReactCacheEntry } = {}
async function getReact (version: string): Promise<ReactCacheEntry> {
  if (reactCache[version]) {
    return reactCache[version]
  }

  const reactCacheEntry = reactCache[version] = {} as ReactCacheEntry
  const majorVersion = parseInt(version.split('.')[0], 10)

  if (majorVersion >= 16) {
    const reactUrl = `https://cdnjs.cloudflare.com/ajax/libs/react/${version}/umd/react.production.min.js`
    await getUMD(reactUrl, reactCacheEntry)

    // this expects "React" to already be defined
    const reactDomServerUrl = `https://cdnjs.cloudflare.com/ajax/libs/react-dom/${version}/umd/react-dom-server.browser.production.min.js`
    await getUMD(reactDomServerUrl, reactCacheEntry)
  } else {
    // React had a major overhaul in their build process at version 16. So, doing the above trick won't work.
    // Using a version >=16 is really necessary to get the full benefits of SSR (ReactDOM.hydrate wasn't added until 16)
    // So, not supporting <=15 shouldn't be a big deal.

    // (Note: it's still possible to support <=15, I just don't care to figure it out right now.)

    // hopefully we can get the website migrated to version 16 before Theia goes live

    throw new Error('unsupported version of react: ' + version)
  }

  return reactCacheEntry
}

/*
  This works because the UMD bundle (targeted for browsers) defines React on the global window object
  by passing "this" to a module function. In the browser context, "this" points to "window" at the top scope.
  By creating a new scope above the module code, we can modify where React gets stored.
*/
async function getUMD (url: string, thisContext: object): Promise<void> {
  // TODO: not sure why tslint says that "rp.get" does not return a promise.
  const fn = new Function(await rp.get(url)) // tslint:disable-line
  fn.call(thisContext)
}

export type OnBeforeRenderArgs = {
  core: Core
  componentLibrary: string
  component: string
  props: object
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

export type BeforeRenderHook = Tapable.ITypedAsyncParallelHook<{core: Core, componentLibrary: string, component: string, props: object}>
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
    componentLibraryUpdate: ComponentLibraryUpdateHook
    error: ErrorHook
    express: ExpressHook
    render: RenderHook
    start: StartHook
  } = {
    beforeRender: new TypedAsyncParallelHook(['core', 'componentLibrary', 'component', 'props']),
    componentLibraryUpdate: new TypedAsyncParallelHook(['core', 'componentLibrary', 'manifestEntry']),
    error: new TypedAsyncParallelHook(['core', 'error']),
    express: new TypedAsyncParallelHook(['core', 'app']),
    render: new TypedAsyncParallelHook(['core', 'componentLibrary', 'component', 'props']),
    start: new TypedAsyncParallelHook(['core'])
  }

  libCache: { [key: string]: ComponentLibrary } = {}
  buildManifestCache: { [key: string]: BuildManifest } = {}
  statsContentsCache: { [key: string]: Stats } = {}

  constructor (config: Required<Configuration>) {
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

  // TODO: should only hit storage if build files are not in cache/memory.
  // need to cache stats/build-manifest.json files just like source is being cached
  async render (componentLibrary: string, componentName: string, props: object): Promise<RenderResult> {
    // don't wait for completion
    this.hooks.beforeRender.promise({ core: this, componentLibrary, component: componentName, props }).catch(err => {
      // TODO: find out how to get which plugin threw the error
      const plugin = 'plugin'
      this.logError(`theia:${plugin}:beforeRender`, err)
    })

    // TODO: this version should come from the CL's yarn.lock. at build time, the react version should be
    // saved in build-manifest.json for that CL
    const reactVersion = '16.2.0'
    const { React, ReactDOMServer } = await getReact(reactVersion)

    const component = await this.getComponent(reactVersion, componentLibrary, componentName)
    const html = ReactDOMServer.renderToString(React.createElement(component, props))

    // TODO: code splitting w/ universal components
    const assets = await this.getAssets(componentLibrary)

    // don't wait for completion
    this.hooks.render.promise({ core: this, componentLibrary, component: componentName, props }).catch(err => {
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
    const statsContents = await this.storage.load(componentLibrary, latest.stats)
    return this.statsContentsCache[componentLibrary] = JSON.parse(statsContents)
  }

  async getComponentLibrary (reactVersion: string, componentLibrary: string): Promise<ComponentLibrary> {
    if (this.libCache[componentLibrary]) {
      return this.libCache[componentLibrary]
    }

    if (!this.hasBuildManifest(componentLibrary)) {
      throw new Error(`${componentLibrary} is not a registered component library`)
    }

    const stats = await this.getLatestStatsContents(componentLibrary)
    const componentManifestBasename = stats.assetsByChunkName.manifest.find((asset: string) => asset.startsWith('manifest') && asset.endsWith('.js'))
    const source = await this.storage.load(componentLibrary, componentManifestBasename!)
    const { React } = await getReact(reactVersion)
    const window = { React } // tslint:disable-line
    const evaluated = eval(source)

    if (!evaluated.default) {
      throw new Error(`${componentLibrary} component manifest does not have a default export`)
    }

    return this.libCache[componentLibrary] = evaluated.default
  }

  async getComponent (reactVersion: string, componentLibrary: string, component: string): Promise<ReactComponentClass> {
    const lib = await this.getComponentLibrary(reactVersion, componentLibrary)

    if (!(component in lib)) {
      throw new Error(`${component} is not a registered component of ${componentLibrary}`)
    }

    return lib[component]
  }

  // temporary. just returns all the assets for a CL. change when codesplitting is working
  async getAssets (componentLibrary: string): Promise<RenderResultAssets> {
    const stats = await this.getLatestStatsContents(componentLibrary)
    const manifestAssets = stats.assetsByChunkName.manifest

    return {
      javascripts: manifestAssets.filter((asset: string) => asset.endsWith('.js')),
      stylesheets: manifestAssets.filter((asset: string) => asset.endsWith('.css'))
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
      this.logError('theia:build-all', 'error while building component libraries')
      this.logError('theia:build-all', err)
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

  log (namespace: string, error: any) {
    _log(namespace, error)
  }

  logError (namespace: string, error: Error | string) {
    _logError(namespace, error)
    this.hooks.error.promise({ core: this, error }).catch(err => {
      _logError(namespace, `there was an error in the error handling hooks: ${err}`)
    })
  }
}

export default Core
