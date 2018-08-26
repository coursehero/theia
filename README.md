# Theia

[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lernajs.io/)

### Server Side Rendering And React Build Server as a Service (SSR&RBSaaS)

Theia provides:

* A build server for your React applications
* Server side rendering from any runtime over an HTTP interface
* Automated caching - cache every view of your application, updated with every new version with zero cache misses
* A plugin system to configure most behavior

## Usage

### Theia Server

This will run the server locally:

```
./bin/run
```

`theia.config.ts` defines the plugins and configuration to use.

`theia.Configuration` options:

| Name            | Type                                      | Default                                     | Description |
| --------------- | ----------------------------------------- | ------------------------------------------- | ----------- |
| builder         | `Builder`                                 | DefaultBuilder                              |
| environment     | `'development' `&#124;` 'production'`     | process.env.THEIA_ENV || 'development'      |
| libs            |`{ [name]: ComponentLibraryConfiguration }`| required                                    | CLs
| plugins         | `Plugin[]`                                | []                                          | 
| storage         | `Storage`                                 | LocalStorage("libs")                        |
| verbose         | `boolean`                                 | true                                        |


ComponentLibraryConfiguration:
```
branches: { // branch to build from for particular environment
  development: string
  production: string 
}
source: string // git remote
```

#### Rendering HTTP API

The body contains the props to render.

```
POST /render?componentLibrary=mythos&component=Greeting
Content-Type: application/json
{
  "name": "World"
}
```

Body (HTML):
```html
<div data-reactroot="">Hello <em>World</em>!!!</div>
```

`Theia-Assets` response header (asset names):
```json
{
  "javascripts": [
    "manifest.19921ef415ad5c4fdaf5.js"
  ],
  "stylesheets": []
}
```

[See live](http://theia.dev-internal.coursehero.com/)

### Component Library

Component Library (CL) - React libraries which 1) build themselves and 2) export components via a component manifest module.

View [mythos](https://github.com/theiajs/mythos) for an simple example CL.
View [study guides](https://git.coursehero.com/coursehero/components/study-guides) for a production example CL. This uses TypeScript and implements hot code reloading.

### Rendering Client

A [PHP SDK](https://git.coursehero.com/coursehero/sdk/theia-php) is provided to wrap the HTTP API, and provide a caching mechanism.

```php
$client = $this->theiaProviderService->getClient();
$propsAsString = StudyGuideTheiaJobHandler::getProps(...);
$renderResult = $client->renderAndCache('@coursehero/study-guides', 'CourseApp', $propsAsString);
//                  or ->render to avoid cache

$renderResult->isRetrievedFromCache();
$renderResult->getHtml();
$renderResult->getAssets();
```

See `StudyGuideController::courseAction` for a production example.

### Cache Reheating Jobs

Theia defines a job protocol to keep the cached contents of your React app up-to-date with the latest version.

In the Monolith, implement a `TheiaJobHandler` for your CL.

When Theia builds a new version of a CL, a `new-build-job` is emiitted, and `TheiaJobHandler::processNewBuildJob` is eventually called. A `new-build-job` should split up the work by emitting multiple `render-job`s, or if there are many pages to cache, it should emit `producer-job`s that themselves emit a subset of `render-job`s. How this work is broken up is specific to each CL. Breaking up the caching work creates a more fault tolerant system - if a single job fails, it will be retried without redoing much work.

The props given to the Theia Job Handler and the props given to the rendering client should be the _exact_ same, and so it is recommended you use the _exact_ same function to generate the props. A good place to keep this function is in your custom job handler.

See `StudyGuideTheiaJobHandler` for a production example.

## TODO

* Create a dashboard to monitor entire system
* Use source maps to map errors during rendering to CL source code
* Confirm that cache job handling scales
* Open source

### Measure Real Performance

Make script that hits testing endpoint on site -> webserver makes request to theia (enable timings, disable wendigo, do with caching and w/o caching) -> script record timings
