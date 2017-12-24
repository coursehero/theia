/* tslint:disable:no-eval */

import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as fs from 'fs-extra'
import * as path from 'path'
import { SyncHook } from 'tapable'

interface TheiaPlugin {
  apply (theia: Theia): void
}

interface TheiaConfiguration {
  development: {
    branch: string
  }

  production: {
    branch: string
  }

  libs: { [key: string]: string }
}

interface TheiaLocalConfiguration {
  libs: { [key: string]: string }
}

interface TheiaBuildManifestLibVersion {
  commitHash: string
  manifest: string
  createdAt: string
}

interface TheiaBuildManifest {
  libs: { [key: string]: TheiaBuildManifestLibVersion[] }
  lastUpdatedAt?: string
}

interface ReactComponentClass extends React.ComponentClass<object> {
}

interface ComponentLibrary {
  [key: string]: ReactComponentClass
}

interface CtorParams {
  configPath: string
  localConfigPath: string
  buildManifestPath: string
  plugins: TheiaPlugin[]
}

global.React = React

const libCache: { [key: string]: ComponentLibrary } = {}

class Theia {
  hooks = {
    start: new SyncHook(['theia']),
    componentLibraryUpdate: new SyncHook(['theia', 'componentLibrary', 'libVersion']),
    express: new SyncHook(['theia', 'app'])
  }

  configPath: string
  config: TheiaConfiguration

  localConfigPath: string
  localConfig: TheiaLocalConfiguration

  buildManifestPath: string
  buildManifest: TheiaBuildManifest

  constructor ({ configPath, localConfigPath, buildManifestPath, plugins }: CtorParams) {
    this.configPath = configPath
    this.config = require(configPath)

    this.localConfigPath = localConfigPath
    this.localConfig = require(localConfigPath)

    this.buildManifestPath = buildManifestPath
    if (fs.existsSync(buildManifestPath)) {
      this.buildManifest = require(buildManifestPath)
    } else {
      this.buildManifest = {
        libs: {}
      }
    }

    for (const plugin of plugins) {
      plugin.apply(this)
    }
  }

  start (): void {
    this.hooks.start.call(this)
  }

  render (componentLibrary: string, componentName: string, props: object): string {
    const component = this.getComponent(componentLibrary, componentName)
    return ReactDOMServer.renderToString(React.createElement(component, props))
  }

  registerComponentLibraryVersion (componentLibrary: string, libVersion: TheiaBuildManifestLibVersion): void {
    const manifest = this.buildManifest

    manifest.libs[componentLibrary] = manifest.libs[componentLibrary] || []
    manifest.libs[componentLibrary].push(libVersion)
    manifest.lastUpdatedAt = libVersion.createdAt

    delete libCache[componentLibrary]

    this.hooks.componentLibraryUpdate.call(this, componentLibrary, libVersion)

    fs.writeFileSync(this.buildManifestPath, JSON.stringify(manifest, null, 2))
  }

  getComponentLibrary (componentLibrary: string): ComponentLibrary {
    if (libCache[componentLibrary]) {
      return libCache[componentLibrary]
    }

    if (!(componentLibrary in this.buildManifest.libs)) {
      throw new Error(`${componentLibrary} is not a registered component library`)
    }

    const libVersions = this.buildManifest.libs[componentLibrary]
    const manifestFilename = libVersions[libVersions.length - 1].manifest
    const manifestPath = path.resolve(__dirname, '..', 'libs', componentLibrary, manifestFilename)
    const source = fs.readFileSync(manifestPath, 'utf8')

    return libCache[componentLibrary] = eval(source).default
  }

  getComponent (componentLibrary: string, component: string): ReactComponentClass {
    const lib = this.getComponentLibrary(componentLibrary)

    if (!(component in lib)) {
      throw new Error(`${component} is not a registered component of ${componentLibrary}`)
    }

    return lib[component]
  }
}

export default Theia
export { TheiaPlugin }
export { TheiaConfiguration }
export { TheiaBuildManifestLibVersion }
export { TheiaBuildManifest }
