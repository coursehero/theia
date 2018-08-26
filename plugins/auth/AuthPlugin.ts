import { Core, CoreHooks, Plugin } from '@coursehero/theia'
import * as HttpStatus from 'http-status-codes'

class AuthPlugin implements Plugin {
  constructor (public header: string, public secret: string) {}

  apply (core: Core) {
    core.hooks.express.tapPromise('AuthPlugin', this.onExpress)
  }

  onExpress = ({ core, app }: CoreHooks.OnExpressArgs) => {
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
