/* tslint:disable:no-eval */

import * as bluebird from 'bluebird'
import * as rp from 'request-promise'
import { AsyncParallelHook } from 'tapable'

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

  libs: Theia.ComponentLibraryConfigurations

  environment: Theia.Environment

  storage: Theia.Storage

  hooks: {
    beforeRender: Tapable.AsyncParallelHook
    componentLibraryUpdate: Tapable.AsyncParallelHook
    error: Tapable.AsyncParallelHook
    express: Tapable.AsyncParallelHook
    render: Tapable.AsyncParallelHook
    start: Tapable.AsyncParallelHook
  } = {
    beforeRender: new AsyncParallelHook(['theia', 'componentLibrary', 'component', 'props']),
    componentLibraryUpdate: new AsyncParallelHook(['theia', 'componentLibrary', 'manifestEntry']),
    error: new AsyncParallelHook(['theia', 'error']),
    express: new AsyncParallelHook(['theia', 'app']),
    render: new AsyncParallelHook(['theia', 'componentLibrary', 'component', 'props']),
    start: new AsyncParallelHook(['theia'])
  }

  libCache: { [key: string]: Theia.ComponentLibrary } = {}
  buildManifestCache: { [key: string]: Theia.BuildManifest } = {}
  statsContentsCache: { [key: string]: Theia.Stats } = {}

  constructor (config: Theia.CompleteConfiguration) {
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
    return this.hooks.start.promise(this).catch(err => {
      this.error(err)
    })
  }

  // TODO: should only hit storage if build files are not in cache/memory.
  // need to cache stats/build-manifest.json files just like source is being cached
  async render (componentLibrary: string, componentName: string, props: object): Promise<Theia.RenderResult> {
    // don't wait for completion
    this.hooks.beforeRender.promise(this, componentLibrary, componentName, props).catch(err => {
      this.error(err)
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
    this.hooks.render.promise(this, componentLibrary, componentName, props).catch(err => {
      this.error(err)
    })

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
    await this.hooks.componentLibraryUpdate.promise(this, componentLibrary, buildManifestEntry).catch(err => {
      this.error(err)
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

    // purposefully serial - yarn has trouble running multiple processes
    return bluebird.each(Object.keys(this.libs), componentLibrary => {
      const componentLibraryConfig = this.libs[componentLibrary]
      return this.builder.build(this, componentLibrary, componentLibraryConfig)
    }).then(() => {
      // ...
    }).catch(err => {
      this.error(err)
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

  error (error: any) {
    console.error(error)
    this.hooks.error.promise(this, error).catch(err => {
      console.error(`there was an error in the error handling hooks: ${err}`)
    })
  }
}

export default Core
