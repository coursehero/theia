import {
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
    const params = {
      Bucket: this.bucket,
      Key: [this.rootDir, componentLibrary, basename].join('/'),
      Body: contents
    }

    return new Promise((resolve, reject) => {
      this.client.putObject(params, (err, data) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  onExists (componentLibrary: string, basename: string): Promise<boolean> {
    const params = {
      Bucket: this.bucket,
      Key: [this.rootDir, componentLibrary, basename].join('/')
    }

    return new Promise((resolve, reject) => {
      return this.client.headObject(params, (err, metadata) => {
        if (err && err.code === 'NotFound') {
          resolve(false)
        } else if (err) {
          reject(err)
        } else {
          resolve(true)
        }
      })
    })
  }

  onCopy (componentLibrary: string, file: string): Promise<void> {
    const basename = path.basename(file)
    const contents = fs.readFileSync(file, 'utf-8')
    return this.onWrite(componentLibrary, basename, contents)
  }

  onLoad (componentLibrary: string, basename: string): Promise<string> {
    const params = {
      Bucket: this.bucket,
      Key: [this.rootDir, componentLibrary, basename].join('/')
    }

    return new Promise((resolve, reject) => {
      this.client.getObject(params, (err, data) => {
        if (err) return reject(err)
        if (!data.Body) return reject('no Body')
        resolve(data.Body.toString())
      })
    })
  }
}

export default S3StoragePlugin
