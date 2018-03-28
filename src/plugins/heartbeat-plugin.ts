import * as express from 'express'

type OnExpressArgs = {
  core: Theia.Core
  app: express.Application
}

class HeartbeatPlugin implements Theia.Plugin {
  apply (core: Theia.Core) {
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
