/// <reference types='react' />

declare namespace Theia {
  type Environment = 'development' | 'production'

  interface Core {
    builder: Builder

    config: Configuration

    environment: Environment
    
    hooks: {
      start: Tapable.SyncHook
      beforeRender: Tapable.SyncHook
      render: Tapable.SyncHook
      componentLibraryUpdate: Tapable.SyncHook
      express: Tapable.SyncHook
      error: Tapable.SyncHook
    }

    storage: Storage

    start(): void
    render (componentLibrary: string, componentName: string, props: object): Promise<RenderResult>
    registerComponentLibrary (componentLibrary: string, buildAssets: string[], buildManifestEntry: Theia.BuildManifestEntry): Promise<void>
    hasBuildManifest (componentLibrary: string): Promise<boolean>
    getBuildManifest (componentLibrary: string): Promise<BuildManifest>
    getLatestStatsContents (componentLibrary: string): Promise<Stats>
    getComponentLibrary (reactVersion: string, componentLibrary: string): Promise<ComponentLibrary>
    getComponent (reactVersion: string, componentLibrary: string, component: string): Promise<ReactComponentClass>
    getAssets (componentLibrary: string): Promise<RenderResultAssets>
    clearCache(componentLibrary?: string): void
    buildAll (): Promise<void>
  }

  interface Builder {
    build (theia: Core, componentLibraryConfig: ComponentLibraryConfiguration): Promise<void>
  }

  interface Storage {
    write (componentLibrary: string, basename: string, contents: string): Promise<void>
    exists (componentLibrary: string, basename: string): Promise<boolean>
    copy (componentLibrary: string, file: string): Promise<void>
    load (componentLibrary: string, basename: string): Promise<string>
  }

  interface Plugin {
    apply (theia: Core): void
  }

  interface Configuration {
    libs: { [key: string]: ComponentLibraryConfiguration }
  }

  interface ComponentLibraryConfiguration {
    name: string
    source: string
    branches: {
      development: string
      production: string
    }
  }

  interface BuildManifestEntry {
    commitHash: string
    commitMessage: string
    author: {
      name: string
      email: string
    }
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
