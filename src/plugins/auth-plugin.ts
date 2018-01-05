import {
  default as Theia,
  TheiaPlugin
} from '../theia'
import * as express from 'express'
import * as HttpStatus from 'http-status-codes'

class AuthPlugin implements TheiaPlugin {
  header: string
  secret: string

  constructor (header: string, secret: string) {
    this.header = header
    this.secret = secret
  }

  apply (theia: Theia) {
    theia.hooks.express.tap('AuthPlugin', this.onExpress.bind(this))
  }

  onExpress (theia: Theia, app: express.Application) {
    app.use((req, res, next) => {
      if (req.get(this.header) === this.secret) {
        return next()
      }

      res.send(HttpStatus.FORBIDDEN)
    })
  }
}

export default AuthPlugin
