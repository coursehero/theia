import * as express from 'express'
import { Core, Plugin } from '../theia'

type OnExpressArgs = {
  core: Core
  app: express.Application
}

class HeartbeatPlugin implements Plugin {
  apply (core: Core) {
    core.hooks.express.tapPromise('HeartbeatPlugin', this.onExpress)
  }

  onExpress = ({ core, app }: OnExpressArgs) => {
    app.get('/heartbeat', (req, res) => {
      res.send('thud thud')
    })

    return Promise.resolve()
  }
}

export default HeartbeatPlugin
