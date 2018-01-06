import {
  default as Theia,
  TheiaPlugin
} from '../theia'
import * as path from 'path'
import * as fs from 'fs-extra'

class LocalStoragePlugin implements TheiaPlugin {
  rootStorageDir: string

  constructor (rootStorageDir: string) {
    this.rootStorageDir = rootStorageDir
  }

  apply (theia: Theia) {
    theia.storage = {
      write: this.onWrite.bind(this),
      exists: this.onExists.bind(this),
      copy: this.onCopy.bind(this),
      load: this.onLoad.bind(this)
    }
  }

  onWrite (componentLibrary: string, basename: string, contents: string) {
    fs.writeFileSync(path.join(this.rootStorageDir, componentLibrary, basename), contents)
  }

  onExists (componentLibrary: string, basename: string): boolean {
    return fs.existsSync(path.join(this.rootStorageDir, componentLibrary, basename))
  }

  onCopy (componentLibrary: string, file: string) {
    const basename = path.basename(file)
    fs.copySync(file, path.join(this.rootStorageDir, componentLibrary, basename))
  }

  onLoad (componentLibrary: string, basename: string): string {
    return fs.readFileSync(path.join(this.rootStorageDir, componentLibrary, basename), 'utf-8')
  }
}

export default LocalStoragePlugin
