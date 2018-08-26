import * as AWS from 'aws-sdk'
import * as fs from 'fs-extra'
import * as mime from 'mime-types'
import * as path from 'path'
import Storage from './Storage'

class S3Storage implements Storage {
  client: AWS.S3 = new AWS.S3()

  constructor (public bucket: string, public rootDir: string) {
    this.write = this.write.bind(this)
    this.exists = this.exists.bind(this)
    this.copy = this.copy.bind(this)
    this.load = this.load.bind(this)
  }

  write (componentLibrary: string, basename: string, contents: string): Promise<void> {
    const params = {
      Bucket: this.bucket,
      Key: [this.rootDir, componentLibrary, basename].join('/'),
      Body: contents,
      ContentType: mime.lookup(basename) || undefined
    }

    return new Promise((resolve, reject) => {
      this.client.putObject(params, (err, data) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  exists (componentLibrary: string, basename: string): Promise<boolean> {
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

  copy (componentLibrary: string, file: string): Promise<void> {
    const basename = path.basename(file)
    const contents = fs.readFileSync(file, 'utf-8')
    return this.write(componentLibrary, basename, contents)
  }

  load (componentLibrary: string, basename: string): Promise<string> {
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

export default S3Storage
