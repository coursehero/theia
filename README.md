# Theia · [![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lernajs.io/)

**README IS A WIP**

_Server Side Rendering And React Build Server as a Service (SSR&RBSaaS)_

Theia is a framework for building, rendering, and caching React applications.

Theia was created to enable React server side rendering for backends not written in Node. Currently, there is just one rendering client (for PHP), but creating one for any language should be straightforward.

Theia attempts to be plugin friendly. Inspired by Webpack, and powered by Webpack's [tapable package](https://github.com/webpack/tapable).

[](toc&max-level=4)

*   [Usage](#usage)
    *   [Theia Server](#theia-server)
        *   [Configuration](#configuration)
        *   [Plugins](#plugins)
    *   [Component Libraries](#component-libraries)
    *   [Rendering Clients](#rendering-clients)
    *   [Render Cache Job Processing](#render-cache-job-processing)
    *   [Full Theia Server Configuration](#full-theia-server-configuration)
*   [Contributing](#contributing)
*   [License](#license)

## Usage

Theia consists of four components;

*   Server
*   Component Libraries (CLs)
*   Rendering clients
*   Render cache job processing (optional)

### Theia Server

```sh
yarn add @coursehero/theia@^1.0.0-alpha.9 @coursehero/theia-express-plugin@^1.0.0-alpha.9 @coursehero/theia-usage-plugin@^1.0.0-alpha.9 typescript ts-node @types/node
```

TypeScript is optional, but recommended for the configuration file.

```sh
yarn theia --help
```

There are two commands - `start` and `build`. `start` will start a web service that responds to incoming rendering requests, and `build` will check for and rebuild new versions of a CL.

The deployment plan for the Theia server should run the `build` command occassionally (recommended every minute), and the `start` command at scale.

The default location for the configuration file is at the root of the project: `theia.config.js`. You can define a different path with the `-c` option (useful if you wish to use TypeScript).

`theia.config.ts`

```ts
import * as theia from '@coursehero/theia'
import ExpressPlugin from '@coursehero/theia-express-plugin'
import UsagePlugin from '@coursehero/theia-usage-plugin'
import * as path from 'path'

const storage: theia.Storage = new theia.LocalStorage(path.resolve(__dirname, 'libs'))

const plugins: theia.Plugin[] = [
  new ExpressPlugin(3000),
  new UsagePlugin()
]

const libs: theia.ComponentLibraryConfigurations = {
  '@coursehero/mythos': {
    source: 'https://github.com/theiajs/mythos.git',
    env: {
      development: 'dev',
      production: 'master'
    }
  }
}

const config: theia.Configuration = {
  libs,
  plugins,
  storage,
}

export default config
```

Do the initial build and start the rendering server:

```
yarn theia -c theia.config.ts build && yarn theia -c theia.config.ts start
```

You should be able to hit `http://localhost:3000/`.

This server configuration does not support any cache reheating - see below for a sample configuration with everything enabled.

#### Configuration

`theia.Configuration` options:

<table>

<thead>

<tr>

<th>Name</th>

<th>Type</th>

<th>Default</th>

<th>Description</th>

</tr>

</thead>

<tbody>

<tr>

<td>builder</td>

<td>`Builder`</td>

<td>DefaultBuilder</td>

</tr>

<tr>

<td>environment</td>

<td>`'development'`|`'production'`</td>

<td>process.env.THEIA_ENV</td>

<td></td>

<td>'development'</td>

</tr>

<tr>

<td>libs</td>

<td>`{ [name]: ComponentLibraryConfiguration }`</td>

<td>required</td>

<td>CLs</td>

</tr>

<tr>

<td>plugins</td>

<td>`Plugin[]`</td>

<td>[]</td>

</tr>

<tr>

<td>storage</td>

<td>`Storage`</td>

<td>LocalStorage("libs")</td>

</tr>

<tr>

<td>verbose</td>

<td>`boolean`</td>

<td>true</td>

</tr>

</tbody>

</table>

ComponentLibraryConfiguration:

```ts
branches: { // branch to build from for particular environment
  development: string
  production: string 
}
source: string // git remote
```

#### Plugins

Theia provides functionality for hooking into behavior.

You can conditionally include plugins by using the provided `nn` (no nulls) helper functions:

```ts
const plugins: theia.Plugin[] = theia.nn([
  new ExpressPlugin(process.env.PORT ? parseInt(process.env.PORT, 10) : 3000),
  process.env.SLACK_TOKEN ? new SlackPlugin({
    channel: process.env.THEIA_ENV === 'production' ? '#theia-prod' : '#theia-dev'
  }) : null,
  new UsagePlugin()
]) 
```

There are a few plugins available that utilize this functionality:

##### @coursehero/theia-auth-plugin

Requires rendering client to provide a secret.

```ts
// 1: HTTP header
// 2: Secret
new AuthPlugin('CH-Auth', process.env.THEIA_AUTH_SECRET)
```

##### @coursehero/theia-build-plugin

Periodically checks for new builds. Prefer using the `build` command, so that building and rendering are seperate processes. This allows rendering to be scaled.

```ts
// 1: time between checking for new builds (ms)
new BuildPlugin(5 * 1000)
```

##### @coursehero/theia-cache-plugin

Handles reheating the render cache after a new build. Only the `new-build-job` strategy is currently supported. After a build, the given SQS queue will recieve a `new-build-job` message. See caching section for more details.

```ts
// { CL: { strategy: 'new-build-job', queue: string } }
new CachePlugin({
  '@coursehero/mythos': {
    strategy: 'new-build-job',
    queue: process.env.THEIA_ENV === 'production' ? 'TheiaReheatJobs' : 'TheiaReheatJobs_dev'
  }
})
```

##### @coursehero/theia-express-plugin

Configures the web server for rendering requests.

```ts
// 1: port
new ExpressPlugin(process.env.PORT ? parseInt(process.env.PORT, 10) : 3000)
```

##### @coursehero/theia-heartbeat-plugin

Provides a /heartbeat endpoint, for health checks.

```ts
new HeartbeatPlugin()
```

##### @coursehero/theia-invalidate-build

Band-aid for preventing cached build information from sticking around too long. When a build command finishes a new build, the rendering instances will only recieve the new build information after this plugin clears the local cache. This needs a better solution.

```ts
// 1: how often to reload build information (ms)
new InvalidateBuildManifestCachePlugin(5000)
```

##### @coursehero/theia-rollbar-plugin

Sends errors to Rollbar

```ts
// 1: auth token
// 2: rollbar environment
new RollbarPlugin(process.env.THEIA_ROLLBAR_TOKEN, process.env.ROLLBAR_ENV)
```

##### @coursehero/theia-slack-plugin

Sends messages about new builds to Slack

```ts
new SlackPlugin({
  channel: process.env.THEIA_ENV === 'production' ? '#theia-prod' : '#theia-dev',
  token: process.env.SLACK_TOKEN
})
```

##### @coursehero/theia-source-map

If a CL provides source maps, this plugin will translate rendering errors to the original source code.

```ts
new SourceMapSupportPlugin()
```

##### @coursehero/theia-usage-plugin

Provides a simple canary page at `/`. This plugin should later be expanded into a useful dashboard.

```ts
new UsagePlugin()
```

##### @coursehero/theia-wendigo-plugin

Generates errors when the same rendering request happens to much in a short period of time. This suggests a caching failure.

```ts
new WendigoPlugin()
```

##### Making your own plugin

TODO

### Component Libraries

Each Component Library is its own repository, and defines 1 or more React components. See [@coursehero/mythos](https://github.com/theiajs/mythos) for an example CL using TypeScript and supporting hot code reloading.

### Rendering Clients

The most direct way to render with Theia is to make a HTTP request. The body contains the props to render.

Request

```js
POST /render?componentLibrary=@coursehero/mythos&component=Greeting
Content-Type: application/json
{
  "name": "World"
}
```

Response Body (HTML):

```html
<div data-reactroot="">Hello <em>World</em>!!!</div>
```

Response Header `Theia-Assets` (asset names):

```json
{
  "javascripts": [
    "manifest.19921ef415ad5c4fdaf5.js"
  ],
  "stylesheets": []
}
```

A [PHP Rendering Client](https://github.com/coursehero/theia-php) is provided to wrap the HTTP interface, and provides additional control around caching.

```php
$client = $this->theiaProviderService->getClient();
$propsAsString = MythosTheiaJobHandler::getProps(...);
$renderResult = $client->renderAndCache('@coursehero/mythos', 'Greeting', $propsAsString);
//                  or ->render to avoid cache

$renderResult->isRetrievedFromCache();
$renderResult->getHtml();
$renderResult->getAssets();
```

### Render Cache Job Processing

Theia defines a job protocol to keep the cached contents of your React app up-to-date with the latest version.

Each CL should implement a `JobHandler`. You may need access to code from your main language backend, so each rendering client provides job handling classes. You should create a service that polls messages from the SQS queue defined in Theia server, serializes them to `JobData`s, and feeds them to `JobProcessor`. See the PHP rendering client for more details.

When Theia builds a new version of a CL, a `new-build-job` is emitted, and `MyComponentLibraryJobHandler::processNewBuildJob` is eventually called. A `new-build-job` should split up the work by emitting multiple `render-job`s, or if there are many pages to cache, it should emit `producer-job`s that themselves emit a subset of `render-job`s. How this work is broken up is specific to each CL. Breaking up the caching work creates a more fault tolerant system - if a single job fails, it will be retried without redoing much work.

The props used to fill the cache in job handlers and the props given to the rendering client when a user requests a page should be the _exact_ same, and so it is recommended you use the _exact_ same function to generate the props. Any slight difference will result in cache misses. A good place to keep this function is as a static method in your custom job handler.

### Full Theia Server Configuration

```ts
import * as theia from '@coursehero/theia'
import AuthPlugin from '@coursehero/theia-auth-plugin'
import BuildPlugin from '@coursehero/theia-build-plugin'
import CachePlugin from '@coursehero/theia-cache-plugin'
import ExpressPlugin from '@coursehero/theia-express-plugin'
import HeartbeatPlugin from '@coursehero/theia-heartbeat-plugin'
import InvalidateBuildManifestCachePlugin from '@coursehero/theia-invalidate-build-manifest-cache-plugin'
import RollbarPlugin from '@coursehero/theia-rollbar-plugin'
import SlackPlugin from '@coursehero/theia-slack-plugin'
import SourceMapSupportPlugin from '@coursehero/theia-source-map-support-plugin'
import UsagePlugin from '@coursehero/theia-usage-plugin'
import WendigoPlugin from '@coursehero/theia-wendigo-plugin'
import * as path from 'path'

const FIVE_MINUTES = 1000 * 60 * 5
const isLocal = process.env.THEIA_LOCAL === '1'
const useLocalStorage = isLocal || process.env.THEIA_LOCAL_STORAGE === '1'
const enablePeriodicBuilding = isLocal || process.env.THEIA_LOCAL_BUILD === '1'

let storage: theia.Storage
if (useLocalStorage) {
  storage = new theia.LocalStorage(path.resolve(__dirname, 'libs'))
} else {
  storage = new theia.S3Storage(
    process.env.THEIA_S3_BUCKET || 'coursehero_dev',
    process.env.THEIA_S3_BUCKET_FOLDER || 'theia'
  )
}

const defaultQueue = process.env.THEIA_ENV === 'production' ? 'TheiaReheatJobs' : 'TheiaReheatJobs_dev'

const plugins: theia.Plugin[] = theia.nn([
  new SourceMapSupportPlugin(),
  process.env.THEIA_ROLLBAR_TOKEN ? new RollbarPlugin(process.env.THEIA_ROLLBAR_TOKEN, process.env.ROLLBAR_ENV!) : null,
  process.env.THEIA_ROLLBAR_TOKEN ? new WendigoPlugin() : null,
  process.env.SLACK_TOKEN ? new SlackPlugin({
    channel: process.env.THEIA_ENV === 'production' ? '#theia-prod' : '#theia-dev',
    token: process.env.SLACK_TOKEN
  }) : null,
  enablePeriodicBuilding ? new BuildPlugin(FIVE_MINUTES) : null,
  new InvalidateBuildManifestCachePlugin(5000), // the DelaySeconds param on 'new-build-job' should compensate for this
  process.env.THEIA_CACHE ? new CachePlugin({
    '@coursehero/mythos': {
      strategy: 'new-build-job',
      queue: defaultQueue
    }
  }) : null,
  new ExpressPlugin(process.env.PORT ? parseInt(process.env.PORT, 10) : 3000),
  new HeartbeatPlugin(),
  process.env.THEIA_AUTH_SECRET ? new AuthPlugin('CH-Auth', process.env.THEIA_AUTH_SECRET) : null,
  new UsagePlugin()
])

const libs: theia.ComponentLibraryConfigurations = {
  '@coursehero/mythos': {
    source: 'https://github.com/theiajs/mythos.git',
    env: {
      development: 'dev',
      production: 'master'
    }
  }
}

const config: theia.Configuration = {
  libs,
  plugins,
  storage,
}

export default config
```

## Contributing

Before opening a PR, ensure that all tests and linting pass.

## License

Apache 2.0
