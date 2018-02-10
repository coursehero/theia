/* tslint:disable:no-eval */

import * as React from 'react' // only imported for typing purposes
import * as path from 'path'
import * as rp from 'request-promise'
import { SyncHook } from 'tapable'

// TODO: can these ts definitions be in their own file?

interface TheiaPlugin {
  apply (theia: Theia): void
}

interface TheiaConfiguration {
  libs: { [key: string]: TheiaConfigurationComponentLibrary }
}

interface TheiaConfigurationComponentLibrary {
  source: string
  branches: {
    development: string
    production: string
  }
}

interface TheiaBuildManifestEntry {
  commitHash: string
  stats: string
  createdAt: string
}

interface TheiaBuildManifest extends Array<TheiaBuildManifestEntry> {}

interface ReactComponentClass extends React.ComponentClass<object> {
}

interface ComponentLibrary {
  [key: string]: ReactComponentClass
}

interface RenderResult {
  html: string
  assets: RenderResultAssets
}

interface RenderResultAssets {
  javascripts: string[]
  stylesheets: string[]
}

interface CtorParams {
  config: TheiaConfiguration
  plugins: TheiaPlugin[]
}

interface Stats {
  assetsByChunkName: {
    manifest: Array<string>
  }
}

// if we ever scale to more than 1 microservice, these caches may present issues
const libCache: { [key: string]: ComponentLibrary } = {}
const buildManifestCache: { [key: string]: TheiaBuildManifest } = {}
const statsContentsCache: { [key: string]: Stats } = {}

interface ReactCacheEntry {
  React: any
  ReactDOMServer: any
}

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

class Theia {
  hooks = {
    // TODO: make all hooks async
    start: new SyncHook(['theia']),
    beforeRender: new SyncHook(['theia', 'componentLibrary', 'component', 'props']),
    render: new SyncHook(['theia', 'componentLibrary', 'component', 'props']),
    componentLibraryUpdate: new SyncHook(['theia', 'componentLibrary', 'manifestEntry']),
    express: new SyncHook(['theia', 'app']),
    error: new SyncHook(['theia', 'error'])
  }

  storage: {
    write (componentLibrary: string, basename: string, contents: string): Promise<void>
    exists (componentLibrary: string, basename: string): Promise<boolean>
    copy (componentLibrary: string, file: string): Promise<void>
    load (componentLibrary: string, basename: string): Promise<string>
  }

  config: TheiaConfiguration

  constructor ({ config, plugins }: CtorParams) {
    this.config = config

    for (const plugin of plugins) {
      plugin.apply(this)
    }
  }

  start (): void {
    this.hooks.start.call(this)
  }

  // TODO: should only hit storage if build files are not in cache/memory.
  // need to cache stats/build-manifest.json files just like source is being cached
  async render (componentLibrary: string, componentName: string, props: object): Promise<RenderResult> {
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

  async registerComponentLibrary (componentLibrary: string, buildAssets: string[], commitHash: string): Promise<void> {
    for (const asset of buildAssets) {
      await this.storage.copy(componentLibrary, asset)
    }

    let manifest: TheiaBuildManifest = []
    if (await this.hasBuildManifest(componentLibrary)) {
      manifest = await this.getBuildManifest(componentLibrary)
    }

    const statsBasename = path.basename(buildAssets.find(asset => path.basename(asset).startsWith('stats')) as string)
    if (!statsBasename) {
      throw new Error(`Building ${componentLibrary} did not emit a stats file`)
    }

    const manifestEntry = {
      commitHash,
      stats: statsBasename,
      createdAt: new Date().toString()
    }
    manifest.push(manifestEntry)
    this.hooks.componentLibraryUpdate.call(this, componentLibrary, manifestEntry)

    const manifestJson = JSON.stringify(manifest, null, 2)
    await this.storage.write(componentLibrary, 'build-manifest.json', manifestJson)

    delete libCache[componentLibrary]
    delete buildManifestCache[componentLibrary]
    delete statsContentsCache[componentLibrary]
  }

  hasBuildManifest (componentLibrary: string): Promise<boolean> {
    return this.storage.exists(componentLibrary, 'build-manifest.json')
  }

  async getBuildManifest (componentLibrary: string): Promise<TheiaBuildManifest> {
    if (buildManifestCache[componentLibrary]) {
      return buildManifestCache[componentLibrary]
    }

    const contents = await this.storage.load(componentLibrary, 'build-manifest.json')
    return buildManifestCache[componentLibrary] = JSON.parse(contents)
  }

  async getLatestStatsContents (componentLibrary: string): Promise<Stats> {
    if (statsContentsCache[componentLibrary]) {
      return statsContentsCache[componentLibrary]
    }

    const buildManifest = await this.getBuildManifest(componentLibrary)
    const latest = buildManifest[buildManifest.length - 1]
    const statsContents = await this.storage.load(componentLibrary, latest.stats)
    return statsContentsCache[componentLibrary] = JSON.parse(statsContents)
  }

  async getComponentLibrary (reactVersion: string, componentLibrary: string): Promise<ComponentLibrary> {
    if (libCache[componentLibrary]) {
      return libCache[componentLibrary]
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

    return libCache[componentLibrary] = evaluated.default
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
}

export default Theia
export { TheiaPlugin }
export { TheiaConfiguration }
export { TheiaBuildManifestEntry }
export { TheiaBuildManifest }
