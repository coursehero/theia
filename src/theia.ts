/* tslint:disable:no-eval */

import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as fs from 'fs-extra'
import * as path from 'path'
import { SyncHook } from 'tapable'

interface TheiaPlugin {
  apply (theia: Theia): void
}

interface TheiaConfigurationFromFilesystem {
  development: {
    branch: string
  }

  production: {
    branch: string
  }

  libs: { [key: string]: TheiaConfigurationComponentLibrary | string }
}

interface TheiaConfiguration {
  libs: { [key: string]: TheiaConfigurationComponentLibrary }
}

interface TheiaConfigurationComponentLibrary {
  source: string

  development: {
    branch: string
  }

  production: {
    branch: string
  }
}

interface TheiaLocalConfiguration {
  libs: { [key: string]: string }
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
  configPath: string
  localConfigPath: string
  plugins: TheiaPlugin[]
}

global.React = React

const libCache: { [key: string]: ComponentLibrary } = {}

class Theia {
  hooks = {
    start: new SyncHook(['theia']),
    render: new SyncHook(['theia']),
    componentLibraryUpdate: new SyncHook(['theia', 'componentLibrary', 'manifestEntry']),
    express: new SyncHook(['theia', 'app'])
  }

  storage: {
    write (componentLibrary: string, basename: string, contents: string): Promise<void>
    exists (componentLibrary: string, basename: string): Promise<boolean>
    copy (componentLibrary: string, file: string): Promise<void>
    load (componentLibrary: string, basename: string): Promise<string>
  }

  configPath: string
  config: TheiaConfiguration

  localConfigPath: string
  localConfig: TheiaLocalConfiguration

  constructor ({ configPath, localConfigPath, plugins }: CtorParams) {
    this.configPath = configPath
    this.config = {
      libs: {}
    }

    // normalize to type TheiaConfiguration
    const configFromFilesystem: TheiaConfigurationFromFilesystem = require(configPath)
    for (const componentLibrary in configFromFilesystem.libs) {
      const componentLibraryConfig = configFromFilesystem.libs[componentLibrary]

      if (typeof componentLibraryConfig === 'string') {
        this.config.libs[componentLibrary] = {
          source: componentLibraryConfig,
          development: configFromFilesystem.development,
          production: configFromFilesystem.production
        }
      } else {
        this.config.libs[componentLibrary] = Object.assign({}, {
          development: configFromFilesystem.development,
          production: configFromFilesystem.production
        }, componentLibraryConfig)
      }
    }

    this.localConfigPath = localConfigPath
    this.localConfig = fs.existsSync(localConfigPath) ? require(localConfigPath) : {}

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
    const component = await this.getComponent(componentLibrary, componentName)
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

    return Promise.resolve()
  }

  hasBuildManifest (componentLibrary: string): Promise<boolean> {
    return this.storage.exists(componentLibrary, 'build-manifest.json')
  }

  async getBuildManifest (componentLibrary: string): Promise<TheiaBuildManifest> {
    const contents = await this.storage.load(componentLibrary, 'build-manifest.json')
    return JSON.parse(contents)
  }

  async getComponentLibrary (componentLibrary: string): Promise<ComponentLibrary> {
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
    const evaluated = eval('var window = {React: React}; ' + source)

    if (!evaluated.default) {
      throw new Error(`${componentLibrary} component manifest does not have a default export`)
    }

    return libCache[componentLibrary] = evaluated.default
  }

  async getComponent (componentLibrary: string, component: string): Promise<ReactComponentClass> {
    const lib = await this.getComponentLibrary(componentLibrary)

    if (!(component in lib)) {
      throw new Error(`${component} is not a registered component of ${componentLibrary}`)
    }

    return lib[component]
  }

  // temporary. just returns all the assets for a CL. change when codesplitting is working
  async getAssets (componentLibrary: string): Promise<RenderResultAssets> {
    const buildManifest = await this.getBuildManifest(componentLibrary)
    const latest = buildManifest[buildManifest.length - 1]
    const statsContents = await this.storage.load(componentLibrary, latest.stats)
    const stats = JSON.parse(statsContents)
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
