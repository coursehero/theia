/* tslint:disable:no-eval */

import * as bluebird from 'bluebird'
import * as path from 'path'
import * as rp from 'request-promise'
import { SyncHook } from 'tapable'
import Builder from './builder'
import LocalStorage from './local-storage'

interface CtorParams {
  builder?: Theia.Builder
  config?: Theia.Configuration
  environment?: Theia.Environment
  plugins?: Theia.Plugin[]
  storage?: Theia.Storage
}

/*
  This loads the production bundle of React for a specified version, evaluates the code,
  and stores within a cache separate from other versions.

  This doesn't have to be dynamic, but this will enable multiple versions of React to be supported.
*/
const reactCache: { [key: string]: Theia.ReactCacheEntry } = {}
async function getReact (version: string): Promise<Theia.ReactCacheEntry> {
  if (reactCache[version]) {
    return reactCache[version]
  }

  const reactCacheEntry = reactCache[version] = {} as Theia.ReactCacheEntry
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

class Core {
  builder: Theia.Builder

  config: Theia.Configuration

  environment: Theia.Environment

  storage: Theia.Storage

  hooks = {
    // TODO: make all hooks async
    start: new SyncHook(['theia']),
    beforeRender: new SyncHook(['theia', 'componentLibrary', 'component', 'props']),
    render: new SyncHook(['theia', 'componentLibrary', 'component', 'props']),
    componentLibraryUpdate: new SyncHook(['theia', 'componentLibrary', 'manifestEntry']),
    express: new SyncHook(['theia', 'app']),
    error: new SyncHook(['theia', 'error'])
  }

  libCache: { [key: string]: Theia.ComponentLibrary } = {}
  buildManifestCache: { [key: string]: Theia.BuildManifest } = {}
  statsContentsCache: { [key: string]: Theia.Stats } = {}

  constructor ({ builder, config, environment, plugins, storage }: CtorParams) {
    this.builder = builder || new Builder()
    this.config = config || { libs: {} }
    this.environment = environment || process.env.THEIA_ENV as Theia.Environment || 'development'
    this.storage = storage || new LocalStorage(path.resolve(__dirname, '..', 'libs'))

    for (const [componentLibraryName, componentLibraryConfig] of Object.entries(this.config.libs)) {
      componentLibraryConfig.name = componentLibraryName
    }

    if (plugins) {
      for (const plugin of plugins) {
        plugin.apply(this)
      }
    }
  }

  start (): void {
    this.hooks.start.call(this)
  }

  // TODO: should only hit storage if build files are not in cache/memory.
  // need to cache stats/build-manifest.json files just like source is being cached
  async render (componentLibrary: string, componentName: string, props: object): Promise<Theia.RenderResult> {
    this.hooks.beforeRender.call(this, componentLibrary, componentName, props)

    // TODO: this version should come from the CL's yarn.lock. at build time, the react version should be
    // saved in build-manifest.json for that CL
    const reactVersion = '16.2.0'
    const { React, ReactDOMServer } = await getReact(reactVersion)

    const component = await this.getComponent(reactVersion, componentLibrary, componentName)
    const html = ReactDOMServer.renderToString(React.createElement(component, props))

    // TODO: code splitting w/ universal components
    const assets = await this.getAssets(componentLibrary)

    this.hooks.render.call(this, componentLibrary, componentName, props)

    return {
      html,
      assets
    }
  }

  async registerComponentLibrary (componentLibrary: string, buildAssets: string[], buildManifestEntry: Theia.BuildManifestEntry): Promise<void> {
    for (const asset of buildAssets) {
      await this.storage.copy(componentLibrary, asset)
    }

    let manifest: Theia.BuildManifest = []
    if (await this.hasBuildManifest(componentLibrary)) {
      manifest = await this.getBuildManifest(componentLibrary)
    }

    manifest.push(buildManifestEntry)
    this.hooks.componentLibraryUpdate.call(this, componentLibrary, buildManifestEntry)

    const manifestJson = JSON.stringify(manifest, null, 2)
    await this.storage.write(componentLibrary, 'build-manifest.json', manifestJson)

    delete this.libCache[componentLibrary]
    delete this.buildManifestCache[componentLibrary]
    delete this.statsContentsCache[componentLibrary]
  }

  hasBuildManifest (componentLibrary: string): Promise<boolean> {
    return this.storage.exists(componentLibrary, 'build-manifest.json')
  }

  async getBuildManifest (componentLibrary: string): Promise<Theia.BuildManifest> {
    if (this.buildManifestCache[componentLibrary]) {
      return this.buildManifestCache[componentLibrary]
    }

    const contents = await this.storage.load(componentLibrary, 'build-manifest.json')
    return this.buildManifestCache[componentLibrary] = JSON.parse(contents)
  }

  async getLatestStatsContents (componentLibrary: string): Promise<Theia.Stats> {
    if (this.statsContentsCache[componentLibrary]) {
      return this.statsContentsCache[componentLibrary]
    }

    const buildManifest = await this.getBuildManifest(componentLibrary)
    const latest = buildManifest[buildManifest.length - 1]
    const statsContents = await this.storage.load(componentLibrary, latest.stats)
    return this.statsContentsCache[componentLibrary] = JSON.parse(statsContents)
  }

  async getComponentLibrary (reactVersion: string, componentLibrary: string): Promise<Theia.ComponentLibrary> {
    if (this.libCache[componentLibrary]) {
      return this.libCache[componentLibrary]
    }

    if (!this.hasBuildManifest(componentLibrary)) {
      throw new Error(`${componentLibrary} is not a registered component library`)
    }

    const buildManifest = await this.getBuildManifest(componentLibrary)
    const latest = buildManifest[buildManifest.length - 1]
    const statsContents = await this.storage.load(componentLibrary, latest.stats)
    const stats = JSON.parse(statsContents)
    const componentManifestBasename = stats.assetsByChunkName.manifest.find((asset: string) => asset.startsWith('manifest') && asset.endsWith('.js'))
    const source = await this.storage.load(componentLibrary, componentManifestBasename)
    const { React } = await getReact(reactVersion)
    const window = { React } // tslint:disable-line
    const evaluated = eval(source)

    if (!evaluated.default) {
      throw new Error(`${componentLibrary} component manifest does not have a default export`)
    }

    return this.libCache[componentLibrary] = evaluated.default
  }

  async getComponent (reactVersion: string, componentLibrary: string, component: string): Promise<Theia.ReactComponentClass> {
    const lib = await this.getComponentLibrary(reactVersion, componentLibrary)

    if (!(component in lib)) {
      throw new Error(`${component} is not a registered component of ${componentLibrary}`)
    }

    return lib[component]
  }

  // temporary. just returns all the assets for a CL. change when codesplitting is working
  async getAssets (componentLibrary: string): Promise<Theia.RenderResultAssets> {
    const stats = await this.getLatestStatsContents(componentLibrary)
    const manifestAssets = stats.assetsByChunkName.manifest

    return {
      javascripts: manifestAssets.filter((asset: string) => asset.endsWith('.js')),
      stylesheets: manifestAssets.filter((asset: string) => asset.endsWith('.css'))
    }
  }

  async buildAll (): Promise<void> {
    console.log('building component libraries ...')

    const libs = this.config.libs

    // purposefully serial - yarn has trouble running multiple processes
    return bluebird.each(Object.keys(libs), componentLibrary => {
      const componentLibraryConfig = libs[componentLibrary]
      return this.builder.build(this, componentLibraryConfig)
    }).then(() => {
      // ...
    }).catch(error => {
      console.error(error)
      this.hooks.error.call(this, error)
      throw error
    })
  }

  clearCache () {
    this.libCache = {}
    this.buildManifestCache = {}
    this.statsContentsCache = {}
  }
}

export default Core
