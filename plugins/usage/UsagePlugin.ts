import { Core, CoreHooks, Plugin } from '@coursehero/theia'

function appendToViews (oldViews: string[] | string | undefined, newView: string) {
  if (Array.isArray(oldViews)) return [...oldViews, newView]
  if (oldViews) return [oldViews, newView]
  return [newView]
}

class UsagePlugin implements Plugin {
  apply (core: Core) {
    core.hooks.express.tapPromise('UsagePlugin', this.onExpress)
  }

  onExpress = ({ core, app }: CoreHooks.OnExpressArgs) => {
    app.set('views', appendToViews(app.get('views'), __dirname + '/views'))

    app.get('/', async (req, res) => {
      const helloWorldResult = await core.render(req, '@coursehero/mythos', 'Greeting', {
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
