# Render Service

## Overview

The purpose of this microservice is to enable server-side React rendering. It will be a node express app.

[Diagram](./resources/diagram-2.jpg)
(Note: this is somewhat combined with a specific use case for the new subject study guides)

## Caching

This microservice will not handle caching. This will be handled on the consuming side. The Monolith will first check a cache for the content it needs, and only then should it defer to the microservice. This process will be abstracted within `RenderBundle/RenderService`.

## Implementation

### Component Registry

The microservice will simply need to add a component library (in the namespace `coursehero/components/`) as a dependency. Each dependency in this namespace will be added to a component registry, via a `component-manifest.js` file located on the component library itself.

coursehero/components/study-guides/component-manifest.js:

```
import StudyGuideCourseApp from './components/course-app/app'
import StudyGuideLandingPageApp from './components/landing-page-app/app'

export default {
    StudyGuideCourseApp,
    StudyGuideLandingPageApp
}
```

The microservice will load each manifest, and add all components to a registry.

When a request comes in, the registry will be consulted:

```js
const loadFromRegistry = (packageName, componentName) => {
    const manifest = require(`${packageName}/component-manifest`);
    if (!manifest || !manifest[componentName]) {
        throw new Error(':(');
    }
    return manifest[componentName];
}

const render = (packageName, componentName, props) => {
    const component = loadFromRegistry(packageName, componentName)
    return ReactDOMServer.renderToString(component, props)
}
```

### Versioning

The `render-service` will create the initial page view for clients, but eventually the client must take over the task of rendering. This means that both the `render-service` and the Monolith should reference the same version of a dependency. Otherwise, the following occurs (taking `StudyGuideCourseApp` as an example):

* if the `render-service` has a newer version of `StudyGuideCourseApp` than the Monolith- assuming no cache, the client would see a new rendering of the app followed by a flicker and the old version taking over. Assuming a naiive cache, the old version would continue to be served, but the previous issue would occur once the cache is cleared
* if the Monolith has a newer version of `StudyGuideCourseApp` than the `render-service`- the client would see an old rendering of the app followed by a flicker and the new version taking over

Thus it is important that the two projects include the same version of `StudyGuideCourseApp`. We can mitigate this issue by enforcing the following:

* Always update packages on `render-service` first.
* Include the hash of the library on the Monolith as part of the cache key. (something like `{hash}:{route}`)
* On Jenkins, fail Monolith builds if the hash of the included React libray (anything under the namespace `coursehero/components`) does not match the hash used in `render-service/master/package.lock`

When `render-service` goes live with the updated packages, consumers would still get the old version from the cache. When the Monolith goes live with the updated packages, the hash will have been updated, and so the cache key used would be new (and be a miss).

The "release gap" between `render-service` updating w/ new packages and the Monolith updating will be unnoticed by consumers of the `render-service`, but ONLY if the old content is in cache. For use cases that warm up the cache (and thus only have a small number of cache items), no issue will occur, since the cache would still contain html rendered with the same version that the Monolith currently has. But, for example, if the UA team wishes to server-side render a widget on the Documents page, the cache can't be filled using every document in our system. There will be cache misses in that case. An example to illustrate:

---

The current version of `DocumentRatingWidget` on the `render-service` and the Monolith has a hash of `ABCD1234`.

1. Push new version of `DocumentRatingWidget` with hash of `ZYXW5678`
2. Update dependency in `render-service`, push to production
3. Update dependency in Monolith, push to production

Between the "release gap" of steps 2 and 3, requests for Document pages will use a key akin to `ABCD1234:@rating-widget/documents/9999/`. If this widget is in cache, no problem. If it is not, it will defer to the `render-service`. The `render-service` will check that the hash matches the hash it is using. It will not match, so it will error. The consuming code will handle this error, and simply not do server-side rendering for this widget. The user will have to wait for the widget to load in the browser.

This will be resolved once the "release gap" closes. The rendering for key `ZYXW5678:@rating-widget/documents/9999/` will succeed (the hashes will match), and server-side rendering will commence.

---

It's the job of the team utilizing `render-service` to "warm up the cache", if that is important. Otherwise every first request will be a cache-miss. The suggested behavior for a cache-miss is to just display a "loading" icon where the react app would have been, and just let the client render it when it's ready. Otherwise, the initial request would take longer than necessary.

#### Monolith Changes

`RenderBundle/RenderService` will need a way to resolve a component name (`StudyGuideCourseApp`) to the package it came from (`coursehero/components/study-guides`) and its hash. The js `gulp` build process will create a `Symfony/config/node-components.yml` file, which will contain an entry for all the packages under the namespace `coursehero/components/` and their correspoding hash values.

node-components.yml:

```yml
coursehero/components/study-guides:
    hash: ABCD1234
```

Additionally, the build step should be updated to fail if there is a mismatch between the hashes in `node-components.yml` and corresponding hashs in `render-service`.

##### Example implementation

RenderService.php:

```php
// $key would typically just be the full route (ex: '/study-guides/intro-to-biology/cells')
public function renderAndCache(string $key, string $package, string $componentName, array $props)
{
    $hash = getHashForPackage($package);
    $hashKey = "$hash:$key";

    $cached = loadFromCache($hashKey);
    if ($cached) return $cached;

    $result = getFromRenderService($componentName, $props);
    addToCache($hashKey, $result);
    return $result;
}
```

## Usage

React components must be added to a library under the namespace `coursehero/components/`. Ex: `coursehero/components/study-guides` will contain the component `StudyGuideCourseApp`.

Consumers of this service will communicate over HTTP (note: this interface will be abstracted within a RenderService in a RenderBundle on the Monolith). For example, to render a component `StudyGuideCourseApp` with props `props`:

```
POST /render?package=coursehero%2Fcomponents%2Fstudy-guides&component=StudyGuideCourseApp
{
    ...props
}
```

This will return the React server-side generated HTML.

The `StudyGuideCourseApp` component must be registered in the `render-service` project, and thus must be included as a dependency in its `package.json`.

Example:

```php
$key = 'some-unique-key (ex: route + component name)';
$package = 'study-guides';
$component = 'DocumentRatingWidget';
$html = $renderService->loadFromCache($key, $package, $component);

if ($html) {
    // succeeded
    return $this->render('my.html.twig', [
        "widgetHtml" => $html
    ]);
} else {
    // failed for number of reasons:
    // 1) could not reach microservice
    // 2) version of react component does not match version used on the microservice
    // 3) there was a cache-miss

    // Can handle this case in a couple ways

    -------
    // Render and cache for next time
    $html = $renderService->renderAndCache($key, $package, $component, $props);
    if ($html) {
        return $this->render('my.html.twig', [
            "widgetHtml" => $html
        ]);
    } else {
        // failed because of reason #2 (hash mismatch)
        // no way to recover from this. Must ditch server-side rendering entirely.
        return $this->render('my.html.twig');
    }
    -------
    // Faster response time: Do not server-side render, but warm up cache for next time.
    $renderService->renderAndCacheAsync($key, $package, $component, $props);
    return $this->render('my.html.twig');
}
```

The resulting HTML from the `render-service` should be embedded in a twig file, and include the bundle react application.

## Q&A

Question: Why a microservice? Why not do the rendering on the Monolith?

Answer: This would require installing a v8 (JS) runtime php extension on all of our webservers. The performance implications of this are unclear. Keeping JavaScript off of the webservers is ideal.

## Discussion

https://course-hero.slack.com/archives/C7TH1H9QR/p1510627788000024
