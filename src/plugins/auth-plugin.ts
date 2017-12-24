import {
  default as Theia,
  TheiaPlugin
} from '../theia'
import * as express from 'express'
import * as HttpStatus from 'http-status-codes'

class AuthPlugin implements TheiaPlugin {
  secret: string

  constructor(secret: string) {
    this.secret = secret
  }

  apply(theia: Theia) {
    theia.hooks.express.tap("AuthPlugin", this.onExpress.bind(this))
  }

  onExpress(theia: Theia, app: express.Application) {
    app.use((req, res, next) => {
      if (req.get('CH-Auth') === this.secret) {
        return next()
      }
      
      res.send(HttpStatus.FORBIDDEN)
    })
  }
}

export default AuthPlugin
