# WMCache.js [![Build Status](https://travis-ci.org/uupaa/WMCache.js.png)](http://travis-ci.org/uupaa/WMCache.js)

[![npm](https://nodei.co/npm/uupaa.wmcache.js.png?downloads=true&stars=true)](https://nodei.co/npm/uupaa.wmcache.js/)

Client side temporary storage to boost performance.

## Document

- [WMCache.js wiki](https://github.com/uupaa/WMCache.js/wiki/WMCache)
    - [DEMO](http://uupaa.github.io/Examples/demo/WMCache.js/test/index.html)
- [WebModule](https://github.com/uupaa/WebModule)
    - [Slide](http://uupaa.github.io/Slide/slide/WebModule/index.html)
    - [Development](https://github.com/uupaa/WebModule/wiki/Development)

## Support browsers

- Safari, Mobile Safari (iOS 8+)
- Chrome, Chrome for Android

## How to use

### Browser

```js
<script src="lib/WMCache.js"></script>
<script>
var allow = ["**/*.png", "**/*.jpg", "**/*.m4a"];
var cache = new WMCache({ allow: allow }, cacheReady, function(err) {
                console.log(err.message);
            });

function cacheReady(cache) {
    cache.getBlobURL(url, function(url, blobURL, mime, size) {
        var img = new Image();
        img.src = blobURL;
        document.body.appendChild(img);
    });
}
</script>
```

