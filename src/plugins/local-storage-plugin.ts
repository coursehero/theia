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

  onWrite (componentLibrary: string, basename: string, contents: string): Promise<void> {
    return fs.writeFile(path.join(this.rootStorageDir, componentLibrary, basename), contents)
  }

  onExists (componentLibrary: string, basename: string): Promise<boolean> {
    return fs.pathExists(path.join(this.rootStorageDir, componentLibrary, basename))
  }

  onCopy (componentLibrary: string, file: string): Promise<void> {
    const basename = path.basename(file)
    return fs.copy(file, path.join(this.rootStorageDir, componentLibrary, basename))
  }

  onLoad (componentLibrary: string, basename: string): Promise<string> {
    return fs.readFile(path.join(this.rootStorageDir, componentLibrary, basename), 'utf-8')
  }
}

export default LocalStoragePlugin
