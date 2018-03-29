import * as express from 'express'
import * as HttpStatus from 'http-status-codes'

type OnExpressArgs = {
  core: Theia.Core
  app: express.Application
}

class AuthPlugin implements Theia.Plugin {
  constructor (public header: string, public secret: string) {}

  apply (core: Theia.Core) {
    core.hooks.express.tapPromise('AuthPlugin', this.onExpress)
  }

  onExpress = ({ core, app }: OnExpressArgs) => {
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
