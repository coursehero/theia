import 'newrelic'

{
  const theia = require('./configure-theia').default
  theia.builder.buildAll(theia)
}
