import * as express from 'express'
import { Core, Plugin } from '../theia'

type OnExpressArgs = {
  core: Core
  app: express.Application
}

class UsagePlugin implements Plugin {
  apply (core: Core) {
    core.hooks.express.tapPromise('UsagePlugin', this.onExpress)
  }

  onExpress = ({ core, app }: OnExpressArgs) => {
    app.get('/', async (req, res) => {
      const helloWorldResult = await core.render('mythos', 'Greeting', {
        name: 'World'
      })

      res.render('usage', {
        helloWorldResultHtml: helloWorldResult.html,
        helloWorldResultAssets: JSON.stringify(helloWorldResult.assets, null, 2)
      })
    })

    return Promise.resolve()
  }
}

export default UsagePlugin
