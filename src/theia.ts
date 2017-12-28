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
    render: new SyncHook(['theia']),
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
    const result = ReactDOMServer.renderToString(React.createElement(component, props))

    this.hooks.render.call(this, componentLibrary, componentName, props)

    return result
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
    const evaluated = eval(source)

    if (!evaluated.default) {
      throw new Error(`${componentLibrary} component manifest does not have a default export`)
    }

    return libCache[componentLibrary] = evaluated.default
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
