import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'

import * as fs from 'fs-extra'
import * as path from 'path'
import { SyncHook } from 'tapable'

global['React'] = React

let libCache = {}

interface TheiaConfiguration {
    development: {
        branch: string
    }

    production: {
        branch: string
    }

    libs: {[key: string]: string}
}

interface TheiaBuildManifestLibVersion {
    commitHash: string,
    manifest: string,
    createdAt: string
}

interface TheiaBuildManifest {
    libs: {[key: string]: TheiaBuildManifestLibVersion[]}
    lastUpdated?: string
}

class Theia {
    hooks = {
        start: new SyncHook(['theia']),
        componentLibraryUpdate: new SyncHook(['theia', 'componentLibrary', 'libVersion'])
    }

    configPath: string
    config: TheiaConfiguration

    buildManifestPath: string
    buildManifest: TheiaBuildManifest

    constructor(configPath: string, buildManifestPath: string) {
        this.configPath = configPath
        this.config = require(configPath)

        this.buildManifestPath = buildManifestPath
        if (fs.existsSync(buildManifestPath)) {
            this.buildManifest = require(buildManifestPath)
        } else {
            this.buildManifest = {
                libs: {}
            }
        }
    }

    start() {
        this.hooks.start.call(this)
    }

    render(componentLibrary: string, componentName: string, props: object) : string {
        const component = this.getComponent(componentLibrary, componentName)
        return ReactDOMServer.renderToString(React.createElement(component, props))
    }

    registerComponentLibraryVersion(componentLibrary: string, libVersion: TheiaBuildManifestLibVersion) {
        const manifest = this.buildManifest

        manifest.libs[componentLibrary] = manifest.libs[componentLibrary] || []
        manifest.libs[componentLibrary].push(libVersion)
        manifest.lastUpdated = libVersion.createdAt

        delete libCache[componentLibrary]

        this.hooks.componentLibraryUpdate.call(this, componentLibrary, libVersion)
        
        fs.writeFileSync(this.buildManifestPath, JSON.stringify(manifest, null, 2))
    }

    loadComponentLibrary(componentLibrary: string) {
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

    getComponent(componentLibrary: string, component: string) {
        const lib = this.loadComponentLibrary(componentLibrary)

        if (!(component in lib)) {
            throw new Error(`${component} is not a registered component of ${componentLibrary}`)
        }

        return lib[component]
    }
}

export default Theia
