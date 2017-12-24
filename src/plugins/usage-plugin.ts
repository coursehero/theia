import {
  default as Theia,
  TheiaPlugin
} from '../theia'
import * as express from 'express'

class UsagePlugin implements TheiaPlugin {
  apply(theia: Theia) {
    theia.hooks.express.tap("UsagePlugin", this.onExpress)
  }

  onExpress(theia: Theia, app: express.Application) {
    app.get('/', (req, res) => {
      const helloWorldResult = theia.render('@coursehero-components/mythos', 'Greeting', {
        name: 'World'
      })

      res.render('index', {
        helloWorldResult,
        helloWorldResultRaw: `<pre>${helloWorldResult}</pre>`
      })
    })

  }
}

export default UsagePlugin
