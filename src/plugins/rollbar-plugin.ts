import {
  default as Theia,
  TheiaPlugin
} from '../theia'

class RollbarPlugin implements TheiaPlugin {
  apply (theia: Theia) {
    theia.hooks.render.tap('RollbarPlugin', this.onRender.bind(this))
  }

  onRender (theia: Theia, componentLibrary: string, componentName: string, props: object) {
    // TODO: should create rollbar errors if the same component/props is rendered repeatedly, which suggests
    // cache failure
    console.log(`rollbar plugin ...`)
    console.log('TODO: implement')
  }
}

export default RollbarPlugin
