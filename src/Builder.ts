import { ComponentLibraryConfiguration, Core } from './theia'

interface Builder {
  build (theia: Core, componentLibrary: string, componentLibraryConfig: ComponentLibraryConfiguration): Promise<void>
}

export default Builder
