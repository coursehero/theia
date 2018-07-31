import { Core, CoreHooks, Plugin } from '../theia'

class HeartbeatPlugin implements Plugin {
  apply (core: Core) {
    core.hooks.express.tapPromise('HeartbeatPlugin', this.onExpress)
  }

  onExpress = ({ core, app }: CoreHooks.OnExpressArgs) => {
    app.get('/heartbeat', (req, res) => {
      res.send('thud thud')
    })

    return Promise.resolve()
  }
}

export default HeartbeatPlugin
