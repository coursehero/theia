/// <reference types='react' />

declare namespace Theia {
  type Environment = 'development' | 'production'

  interface Core {
    buildAll (): Promise<void>
    builder: Builder
    clearCache(componentLibrary?: string): void
    libs: ComponentLibraryConfigurations
    environment: Environment
    getAssets (componentLibrary: string): Promise<RenderResultAssets>
    getBuildManifest (componentLibrary: string): Promise<BuildManifest>
    getComponent (reactVersion: string, componentLibrary: string, component: string): Promise<ReactComponentClass>
    getComponentLibrary (reactVersion: string, componentLibrary: string): Promise<ComponentLibrary>
    getLatestStatsContents (componentLibrary: string): Promise<Stats>
    hasBuildManifest (componentLibrary: string): Promise<boolean>
    hooks: {
      beforeRender: Tapable.SyncHook
      componentLibraryUpdate: Tapable.SyncHook
      error: Tapable.SyncHook
      express: Tapable.SyncHook
      render: Tapable.SyncHook
      start: Tapable.SyncHook
    }
    registerComponentLibrary (componentLibrary: string, buildAssets: string[], buildManifestEntry: Theia.BuildManifestEntry): Promise<void>
    render (componentLibrary: string, componentName: string, props: object): Promise<RenderResult>
    start(): void
    storage: Storage
  }

  interface Builder {
    build (theia: Core, componentLibrary: string, componentLibraryConfig: ComponentLibraryConfiguration): Promise<void>
  }

  interface Storage {
    copy (componentLibrary: string, file: string): Promise<void>
    exists (componentLibrary: string, basename: string): Promise<boolean>
    load (componentLibrary: string, basename: string): Promise<string>
    write (componentLibrary: string, basename: string, contents: string): Promise<void>
  }

  interface Plugin {
    apply (theia: Core): void
  }

  interface Configuration {
    builder?: Builder
    environment?: Environment
    libs: ComponentLibraryConfigurations
    plugins?: Plugin[]
    storage?: Storage
    verbose?: boolean
  }

  interface CompleteConfiguration {
    builder: Builder
    environment: Environment
    libs: ComponentLibraryConfigurations
    plugins: Plugin[]
    storage: Storage
    verbose: boolean
  }

  interface ComponentLibraryConfigurations {
    [key: string]: ComponentLibraryConfiguration
  }

  interface ComponentLibraryConfiguration {
    branches: {
      development: string
      production: string
    }
    // name: string
    source: string
  }

  interface BuildManifestEntry {
    author: {
      name: string
      email: string
    }
    commitHash: string
    commitMessage: string
    createdAt: string
    stats: string
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

  interface ResponseError extends Error {
    status?: number
  }
}
