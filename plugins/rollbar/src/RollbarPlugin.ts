import { Core, CoreHooks, Plugin } from '@coursehero/theia'
import * as Rollbar from 'rollbar'

class RollbarPlugin implements Plugin {
  rollbar: Rollbar

  constructor (accessToken: string, environment: string) {
    this.rollbar = new Rollbar({
      accessToken,
      environment
    })
  }

  apply (core: Core) {
    core.hooks.error.tapPromise('RollbarPlugin', this.onError)
  }

  onError = ({ core, error }: CoreHooks.OnErrorArgs) => {
    // tslint:disable-next-line
    return new Promise((resolve, reject) => {
      this.rollbar.error(error, err => {
        if (err) reject(err)
        resolve()
      })
    })
  }
}

export default RollbarPlugin
