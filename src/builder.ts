import { ComponentLibraryConfiguration, Core } from './theia'

abstract class Builder {
  abstract build (theia: Core, componentLibrary: string, componentLibraryConfig: ComponentLibraryConfiguration): Promise<void>
}

export default Builder
