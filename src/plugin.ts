import { Core } from './theia'

interface Plugin {
  apply (theia: Core): void
}

export default Plugin
