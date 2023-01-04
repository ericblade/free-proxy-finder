free-proxy-finder
=================

Prototype for a module that will search lists of available proxies for proxy servers that are reachable in a timely fashion.

Currently consumes two different free proxy lists, then maps them through a function that tests if they work and respond within a given period of time.  Holds onto the list for use later.

Usage
-----

easiest:

````javascript
import { getRandomProxy, getNextProxy, initProxyFinder } from 'free-proxy-finder';
initProxyFinder();
````

then when you need a proxy, either use

````javascript
getRandomProxy();
````

or

````javascript
getNextProxy();
````

or, the harder way, the init function does this

````javascript
    loadAllowList('allowlist.json');
    loadDenyList('denylist.json');
    testProxyCache({
        timeout: 8000,
        verboseLogging: true,
        retestDenies: false,
        saveOnChange: true,
    }).then(() => {
        console.warn('* proxy update completed');
        console.warn('* proxyDenyList', proxyDenyList.length);
        console.warn('* proxyAllowList', proxyAllowList.length);
    });
````

Please refer to the source code for information as to what other functions and options are available.
