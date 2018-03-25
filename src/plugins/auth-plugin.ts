import * as express from 'express'
import * as HttpStatus from 'http-status-codes'

class AuthPlugin implements Theia.Plugin {
  constructor (public header: string, public secret: string) {}

  apply (core: Theia.Core) {
    core.hooks.express.tapPromise('AuthPlugin', this.onExpress)
  }

  onExpress = (core: Theia.Core, app: express.Application) => {
    app.use((req, res, next) => {
      if (req.get(this.header) === this.secret) {
        return next()
      }

      res.sendStatus(HttpStatus.FORBIDDEN)
    })

    return Promise.resolve()
  }
}

export default AuthPlugin
