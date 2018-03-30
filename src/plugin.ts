import { Core } from './theia'

abstract class Plugin {
  abstract apply (theia: Core): void
}

export default Plugin
