import * as express from 'express'
import * as HttpStatus from 'http-status-codes'

class AuthPlugin implements Theia.Plugin {
  header: string
  secret: string

  constructor (header: string, secret: string) {
    this.header = header
    this.secret = secret
  }

  apply (core: Theia.Core) {
    core.hooks.express.tap('AuthPlugin', this.onExpress.bind(this))
  }

  onExpress (core: Theia.Core, app: express.Application) {
    app.use((req, res, next) => {
      if (req.get(this.header) === this.secret) {
        return next()
      }

      res.sendStatus(HttpStatus.FORBIDDEN)
    })
  }
}

export default AuthPlugin
