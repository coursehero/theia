import * as express from 'express'
import * as HttpStatus from 'http-status-codes'
import { Core, Plugin } from '../theia'

type OnExpressArgs = {
  core: Core
  app: express.Application
}

class AuthPlugin implements Plugin {
  constructor (public header: string, public secret: string) {}

  apply (core: Core) {
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
