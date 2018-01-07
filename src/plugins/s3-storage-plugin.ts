/*import {
  default as Theia,
  TheiaPlugin
} from '../theia'
import * as path from 'path'
import * as fs from 'fs-extra'
import * as AWS from 'aws-sdk'

class S3StoragePlugin implements TheiaPlugin {
  bucket: string
  rootDir: string
  client: AWS.S3

  constructor (bucket: string, rootDir: string) {
    this.bucket = bucket
    this.rootDir = rootDir
    this.client = new AWS.S3()
    this.client
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
    let params = {
      Bucket: this.bucket,
      Key: [this.rootDir, componentLibrary, basename].join('/'),
      Body: contents
    }

    const client = this.client
    const makeUpload = function () {
      return new Promise((resolve, reject) => {
        client.putObject(params, (err, data) => {
          console.log(err)
          console.log(data)
          if (err) return reject(err)
          resolve(data)
        })
      })
    }

    console.log('uploading ' + basename)
    const b = (async () => {
      const a = await makeUpload()
    console.log('done uploading ' + basename)
      console.log(a)
    })()
    // let re = await makeUpload()

    // this.client.putObject(params, (err, data) => {
    //   console.log(err)
    //   console.log(data)
    // })

    // fs.writeFileSync(path.join(this.bucket, componentLibrary, basename), contents)
  }

  onExists (componentLibrary: string, basename: string): boolean {
    return false
    // return fs.existsSync(path.join(this.bucket, componentLibrary, basename))
  }

  onCopy (componentLibrary: string, file: string) {
    const basename = path.basename(file)
    const contents = fs.readFileSync(file)
    this.onWrite(componentLibrary, basename, contents)
  }

  onLoad (componentLibrary: string, basename: string): string {
    return ''
    // return fs.readFileSync(path.join(this.bucket, componentLibrary, basename), 'utf-8')
  }
}

export default S3StoragePlugin
*/
