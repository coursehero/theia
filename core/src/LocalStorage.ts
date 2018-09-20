import * as fs from 'fs-extra'
import * as path from 'path'
import Storage from './Storage'

class LocalStorage implements Storage {
  constructor (public rootStorageDir: string) {
    this.write = this.write.bind(this)
    this.exists = this.exists.bind(this)
    this.copy = this.copy.bind(this)
    this.load = this.load.bind(this)
  }

  write (componentLibrary: string, basename: string, contents: string): Promise<void> {
    return fs.outputFile(path.join(this.rootStorageDir, componentLibrary, basename), contents)
  }

  exists (componentLibrary: string, basename: string): Promise<boolean> {
    return fs.pathExists(path.join(this.rootStorageDir, componentLibrary, basename))
  }

  copy (componentLibrary: string, file: string): Promise<void> {
    fs.mkdirpSync(path.join(this.rootStorageDir, componentLibrary))
    const basename = path.basename(file)
    return fs.copy(file, path.join(this.rootStorageDir, componentLibrary, basename))
  }

  load (componentLibrary: string, basename: string): Promise<string> {
    return fs.readFile(path.join(this.rootStorageDir, componentLibrary, basename), 'utf-8')
  }
}

export default LocalStorage
