/// <reference path="../../node_modules/@types/react/index.d.ts" />

declare namespace Theia {
  type Environment = 'development' | 'production'

  interface Plugin {
    apply (theia: any): void // TODO: type this as Theia
  }

  interface Configuration {
    libs: { [key: string]: ConfigurationComponentLibrary }
  }

  interface ConfigurationComponentLibrary {
    source: string
    branches: {
      development: string
      production: string
    }
  }

  interface BuildManifestEntry {
    commitHash: string
    stats: string
    createdAt: string
  }

  interface BuildManifest extends Array<BuildManifestEntry> {}

  interface ReactComponentClass extends React.ComponentClass<object> {}

  interface ReactCacheEntry {
    React: any
    ReactDOMServer: any
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

  interface Stats {
    assetsByChunkName: {
      manifest: Array<string>
    }
  }
}
