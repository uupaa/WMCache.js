# WMCache.js [![Build Status](https://travis-ci.org/uupaa/WMCache.js.png)](http://travis-ci.org/uupaa/WMCache.js)

[![npm](https://nodei.co/npm/uupaa.wmcache.js.png?downloads=true&stars=true)](https://nodei.co/npm/uupaa.wmcache.js/)

Client side temporary storage to boost performance.

## Document

- [WMCache.js wiki](https://github.com/uupaa/WMCache.js/wiki/WMCache)
- [WebModule](https://github.com/uupaa/WebModule)
    - [Slide](http://uupaa.github.io/Slide/slide/WebModule/index.html)
    - [Development](https://github.com/uupaa/WebModule/wiki/Development)

## How to use

### Browser

```js
<script src="lib/WMCache.js"></script>
<script>
var cache = new WMCache({}, function(cache) {
                cache.get(url, function(ur, data, mime, size) {
                });
            }, function(err) {
                console.log(err.message);
            });
</script>
```

