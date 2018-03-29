/// <reference types='react' />

declare namespace Theia {
  type Environment = 'development' | 'production'

  type BeforeRenderHook = Tapable.ITypedAsyncParallelHook<{core: Core, componentLibrary: string, component: string, props: object}>
  type ComponentLibraryUpdateHook = Tapable.ITypedAsyncParallelHook<{core: Core, componentLibrary: string, manifestEntry: BuildManifestEntry}>
  type ErrorHook = Tapable.ITypedAsyncParallelHook<{core: Core, error: any}>
  type ExpressHook = Tapable.ITypedAsyncParallelHook<{core: Core, app: any}>
  type RenderHook = Tapable.ITypedAsyncParallelHook<{core: Core, componentLibrary: string, component: string, props: object}>
  type StartHook = Tapable.ITypedAsyncParallelHook<{core: Core}>

  interface Core {
    builder: Builder
    libs: ComponentLibraryConfigurations
    environment: Environment
    hooks: {
      beforeRender: BeforeRenderHook
      componentLibraryUpdate: ComponentLibraryUpdateHook
      error: ErrorHook
      express: ExpressHook
      render: RenderHook
      start: StartHook
    }
    storage: Storage
    
    buildAll (): Promise<void>
    clearCache(componentLibrary?: string): void
    getAssets (componentLibrary: string): Promise<RenderResultAssets>
    getBuildManifest (componentLibrary: string): Promise<BuildManifest>
    getComponent (reactVersion: string, componentLibrary: string, component: string): Promise<ReactComponentClass>
    getComponentLibrary (reactVersion: string, componentLibrary: string): Promise<ComponentLibrary>
    getLatestStatsContents (componentLibrary: string): Promise<Stats>
    hasBuildManifest (componentLibrary: string): Promise<boolean>
    log (namespace: string, error: any): void
    logError (namespace: string, error: any): void
    registerComponentLibrary (componentLibrary: string, buildAssets: string[], buildManifestEntry: Theia.BuildManifestEntry): Promise<void>
    render (componentLibrary: string, componentName: string, props: object): Promise<RenderResult>
    start(): Promise<void>
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
    libs?: ComponentLibraryConfigurations
    plugins?: Plugin[]
    storage?: Storage
    verbose?: boolean
    loadFromDisk?: boolean
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
      manifest: string[]
    }
  }

  interface ResponseError extends Error {
    status?: number
  }
}
