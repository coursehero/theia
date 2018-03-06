import theia from './configure-theia'
require('events').EventEmitter.defaultMaxListeners = 0
require('newrelic')

theia.builder.buildAll(theia)
