(function(global) {
"use strict";

// --- dependency modules ----------------------------------
var temporaryStorage = navigator["temporaryStorage"] ||
                       navigator["webkitTemporaryStorage"];
var WMCacheControl = global["WMCacheControl"]; // allow and deny control
var WMCacheProfile = global["WMCacheProfile"]; // DevTools profiler
var URL = global["URL"] || global["webkitURL"];
var FS = global["WMFileSystemStorage"]; // FileSystem backend
var DB = global["WMIndexedDBStorage"];  // IndexedDB backend
var BH = global["WMBlackholeStorage"];  // Blackhole backend

/* caniuse

| API           | IE   | Firefox | Chrome(mobile) | Safari(mobile) | ASOP |
|---------------|------|---------|----------------|----------------|------|
| XHR Lv2       | 10+  | YES     | YES(YES)       | 5.0+(5.1+)     | 4.0+ |
| FileReader    | 10+  | YES     | YES(YES)       | 6.1+(6.1+)     | 4.0+ |
| IndexedDB     | 10+  | YES     | YES(YES)       | 8.0+(8.0+)     | 4.4+ |
| FileSystem    |      |         | YES(YES)       |                |      |
| DiskQuota     |      |         | YES(YES)       |                |      |

 */

// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
//var _runOnBrowser = "document" in global;
var PATH_NORMALIZE = /^\.\//;      // "./a.png" -> "a.png"
var DOT_FILE       = /^\.[^\.\/]/; // ".a.png" Dotfiles was excluded from garbage collection.

// --- class / interfaces ----------------------------------
function WMCache(param,         // @arg Object - { name, deny, allow, limit, garbage }
                 callback,      // @arg Function - cache ready callback(cache:WMCache, backend:StorageString):void
                 errCallback) { // @arg Function - error callback(err:Error):void
                                // @param.name String = "void" - application name
                                // @param.deny URLStringArray = [] - deny URL pattern
                                // @param.allow URLStringArray = [] - allow URL pattern
                                // @param.garbage URLStringArray = [] - garbage URL pattern
                                // @param.limit Integer = 0 - cache limit (unit MB)
    param = param || {};

//{@dev
    $valid($type(param,       "Object"),              WMCache, "param");
    $valid($type(callback,    "Function"),            WMCache, "callback");
    $valid($type(errCallback, "Function"),            WMCache, "errCallback");
    $valid($keys(param,       "name|deny|allow|garbage|limit"), WMCache, "param");
    $valid($type(param.name,  "String|omit"),         WMCache, "param.name");
    $valid($type(param.deny,  "URLStringArray|omit"), WMCache, "param.deny");
    $valid($type(param.allow, "URLStringArray|omit"), WMCache, "param.allow");
    $valid($type(param.garbage, "URLStringArray|omit"), WMCache, "param.garbage");
    $valid($type(param.limit, "Integer|omit"),        WMCache, "param.limit");
//}@dev

    var that = this;
    var name = param["name"] || "void";
    var deny = param["deny"] || [];
    var allow = param["allow"] || [];
    var garbage = param["garbage"] || [];

    this._limit = (param["limit"] || 0) * 1024 * 1024; // to MB
    this._errCallback = errCallback;
    this._control = new WMCacheControl(allow, deny, garbage);
    this._storage = FS["ready"] ? new FS(name, _ready, errCallback) :
                    DB["ready"] ? new DB(name, _ready, errCallback) :
                                  new BH(name, _ready, errCallback);
    function _ready() {
        callback(that);
    }
}

//{@dev
WMCache["repository"] = "https://github.com/uupaa/WMCache.js"; // GitHub repository URL. http://git.io/Help
//}@dev

WMCache["prototype"] = {
    "constructor":   WMCache,               // new WMCache(param:Object, callback:Function, errCallback)
    // --- fetch/store cache ---
    "has":           WMCache_has,           // WMCache#has(url:URLString):Boolean
    "get":           WMCache_get,           // WMCache#get(url:URLString, callback:Function, options:Object = {}):void
    "list":          WMCache_list,          // WMCache#list():Object - { key: size, ... }
    "size":          WMCache_size,          // WMCache#size():Integer - total cache size
    "drop":          WMCache_drop,          // WMCache#drop(url:URLString, callback:Function = null):void
    "store":         WMCache_store,         // WMCache#store(url:URLString, data:Blob|File|ArrayBuffer, mime:MimeTypeString, size:Integer, callback:Function):void
    "clear":         WMCache_clear,         // WMCache#clear(callback:Function = null):void
    "quota":         WMCache_quota,         // WMCache#quota(callback:Function):void
    "gc":            WMCache_gc,            // WMCache#gc():void
    // --- convenient methods ---
    "getText":       WMCache_getText,       // WMCache#getText(url:URLString, callback:Function, options:Object = {}):void
    "getJSON":       WMCache_getJSON,       // WMCache#getJSON(url:URLString, callback:Function, options:Object = {}):void
    "getBlob":       WMCache_getBlob,       // WMCache#getBlob(url:URLString, callback:Function, options:Object = {}):void
    "getBlobURL":    WMCache_getBlobURL,    // WMCache#getBlobURL(url:URLString, callback:Function, options:Object = {}):void
    "getDataURL":    WMCache_getDataURL,    // WMCache#getDataURL(url:URLString, callback:Function, options:Object = {}):void
    "getArrayBuffer":WMCache_getArrayBuffer,// WMCache#getArrayBuffer(url:URLString, callback:Function, options:Object = {}):void
    // --- debug ---
    "clean":         WMCache_clean,         // WMCache#clean():void
    "profile":       WMCache_profile        // WMCache#profile():void
};

// --- implements ------------------------------------------
function WMCache_has(url) { // @arg URLString
                            // @ret Boolean
//{@dev
    $valid($type(url, "URLString"), WMCache_has, "url");
//}@dev

    return this._storage["has"](url.replace(PATH_NORMALIZE, ""));
}

function WMCache_get(url,       // @arg URLString
                     callback,  // @arg Function - callback(url:URLString, data:Blob|File|ArrayBuffer|null, mime:MimeTypeString, size:Integer, cached:Boolean):void
                     options) { // @arg Object = {} - { reget, cors, wait }
                                // @options.reget Boolean = false - force re-download from server.
                                // @options.cors Boolean = false - withCredentials value.
                                // @options.wait Boolean = false - wait for completion of writing.
                                // @desc fetch L2 or L3 cache and store.
//{@dev
    $valid($type(url,      "URLString"), WMCache_get, "url");
    $valid($type(callback, "Function"),  WMCache_get, "callback");
//}@dev

    options = options || {};

//{@dev
    $valid($type(options.reget, "Boolean|omit"), WMCache_get, "options.reget");
    $valid($type(options.cors,  "Boolean|omit"), WMCache_get, "options.cors");
//}@dev

    url = url.replace(PATH_NORMALIZE, "");

    var that = this;

    if ( DOT_FILE.test(url) ) {
        _fetch(this, url, callback);
        return;
    }

    if ( options["reget"] || !this._storage["has"](url) ) { // download?
        var xhr = new XMLHttpRequest();

        xhr["onerror"] = this._errCallback;
        xhr["onload"] = function() {
            var status = xhr["status"];
            if (status >= 200 && status < 300) {
                _loaded(xhr["response"], // Blob or ArrayBuffer
                        xhr["getResponseHeader"]("content-type"), // mime
                        parseInt(xhr["getResponseHeader"]("content-length"), 10)); // size
            } else {
                callback(url, null, "", 0, false); // 404 and other
            }
        };
        if (options["cors"]) { xhr["withCredentials"] = true; }
        xhr["responseType"] = this._storage instanceof FS ? "blob" : "arraybuffer";
        xhr["open"]("GET", url);
        xhr["send"]();
    } else { // fetch cached data
        this._storage["fetch"](url, function(data, mime, size) {
            callback(url, data, mime, size, true);
        });
    }

    function _loaded(data, mime, size) {
        var store = that._control["isStore"](url);

        if (store &&
            that._limit &&
            that._limit < that["size"]() + size) {
            store = false;
        }
        if (store) {
            if (options["wait"]) {
                that._storage["store"](url, data, mime, size, function(code) {
                    _handleStatusCode(code);
                    // Wait for completion of writing.
                    callback(url, data, mime, size, false);
                });
            } else {
                that._storage["store"](url, data, mime, size, _handleStatusCode);
                // Not wait for completion of writing.
                callback(url, data, mime, size, false);
            }
        } else {
            callback(url, data, mime, size, false);
        }
    }
    function _handleStatusCode(code) {
        switch (code) {
        case 200: break;
        case 413: console.log("QuotaExceededError");
                  that["gc"](); // auto gc
                  break;
        case 503: console.log("WriteError");
        }
    }
}

function _fetch(that,       // @arg this
                url,        // @arg URLString
                callback) { // @arg Function - callback(url:URLString, data:Blob|File|ArrayBuffer, mime:MimeTypeString, size:Integer):void
    if ( that._storage["has"](url) ) {
        that._storage["fetch"](url, function(data, mime, size) {
            callback(url, data, mime, size, true);
        });
    } else {
        callback(url, null, "", 0, false); // 404
    }
}

function WMCache_list() { // @ret Object - { url: size, ... }
    return this._storage["list"]();
}

function WMCache_size() { // @ret Integer - total cache size
    return this._storage["size"]();
}

function WMCache_drop(url,        // @arg URLString
                      callback) { // @arg Function = null - callback():void
                                  // @ret Object - { url: size, ... }
    url = url.replace(PATH_NORMALIZE, "");
    this._storage["drop"](url, callback || function() {});
}

function WMCache_store(url,        // @arg URLString
                       data,       // @arg Blob|File|ArrayBuffer
                       mime,       // @arg MimeTypeString
                       size,       // @arg Integer
                       callback) { // @arg Function = null - callback(url:URLString, code:HTTPStatusCode, stored:Boolean):void
//{@dev
    $valid($type(url,      "URLString"),        WMCache_store, "url");
    $valid($type(data,     "Blob|File|ArrayBuffer"), WMCache_store, "data");
    $valid($type(mime,     "MimeTypeString"),   WMCache_store, "mime");
    $valid($type(size,     "Integer"),          WMCache_store, "size");
    $valid($type(callback, "Function|omit"),    WMCache_store, "callback");
//}@dev

    callback = callback || function() {};

    var that = this;
    var to = this._storage instanceof FS ? "blob" :
             this._storage instanceof DB ? "arraybuffer" : "";

    if (to) {
        _convert(data, to, mime, function(result) {
            that._storage["store"](url, result, mime, size, function(code) {
                callback(url, code, true); // stored
            });
        });
    } else {
        callback(url, 204, false); // fake response
    }
}

function WMCache_clear(callback) { // @arg Function = null - callback():void
//{@dev
    $valid($type(callback, "Function|omit"), WMCache_clear, "callback");
//}@dev

    this._storage["clear"](callback || function() {});
}

function WMCache_gc() { // @desc Drop unnecessary cache.
    this._control["gc"](this);
}

function WMCache_getText(url,       // @arg URLString
                         callback,  // @arg Function - callback(url:URLString, text:String, mime:String, size:Integer, cached:Boolean):void
                         options) { // @arg Object = {} - { reget, cors, wait }
    this["get"](url, function(url, data, mime, size, cached) {
        _convert(data, "text", mime, function(result) {
            callback(url, result, mime, size, cached);
        });
    }, options);
}

function WMCache_getJSON(url,       // @arg URLString
                         callback,  // @arg Function - callback(url:URLString, json:Object, mime:String, size:Integer, cached:Boolean):void
                         options) { // @arg Object = {} - { reget, cors, wait }
    this["get"](url, function(url, text, mime, size, cached) {
        _convert(data, "text", mime, function(result) {
            callback(url, JSON.parse(result), mime, size, cached);
        });
    }, options);
}

function WMCache_getBlob(url,       // @arg URLString
                         callback,  // @arg Function - callback(url:URLString, blob:Blob|File, mime:String, size:Integer, cached:Boolean):void
                         options) { // @arg Object = {} - { reget, cors, wait }
    this["get"](url, function(url, data, mime, size, cached) {
        _convert(data, "blob", mime, function(result) {
            callback(url, result, mime, size, cached);
        });
    }, options);
}

function WMCache_getBlobURL(url,       // @arg URLString
                            callback,  // @arg Function - callback(url:URLString, blobURL:BlobURLString, mime:String, size:Integer, cached:Boolean):void
                            options) { // @arg Object = {} - { reget, cors, wait }
    this["get"](url, function(url, data, mime, size, cached) {
        _convert(data, "bloburl", mime, function(result) {
            callback(url, result, mime, size, cached);
        });
    }, options);
}

function WMCache_getDataURL(url,       // @arg URLString
                            callback,  // @arg Function - callback(url:URLString, dataURL:DataURLString, mime:String, size:Integer, cached:Boolean):void
                            options) { // @arg Object = {} - { reget, cors, wait }
    this["get"](url, function(url, data, mime, size, cached) {
        _convert(data, "dataurl", mime, function(result) {
            callback(url, result, mime, size, cached);
        });
    }, options);
}

function WMCache_getArrayBuffer(url,       // @arg URLString
                                callback,  // @arg Function - callback(url:URLString, buffer:ArrayBuffer, mime:String, size:Integer, cached:Boolean):void
                                options) { // @arg Object = {} - { reget, cors, wait }
    this["get"](url, function(url, data, mime, size, cached) {
        _convert(data, "arraybuffer", mime, function(result) {
            callback(url, result, mime, size, cached);
        });
    }, options);
}

function _toBlob(data, mime) {
    return data instanceof Blob ? data
                                : new Blob([data], { "type": mime });
}

function _convert(data, to, mime, callback) {
    var method = "";

    switch (to) {
    case "text":    method = "readAsText"; break;    // Blob|ArrayBuffer -> Text
    case "blob":    callback( _toBlob(data, mime) ); break;
    case "bloburl": callback( URL["createObjectURL"](_toBlob(data, mime)) ); break;
    case "dataurl": method = "readAsDataURL"; break; // Blob|ArrayBuffer -> DataURL
    case "arraybuffer":
        if (data instanceof Blob) {
            method = "readAsArrayBuffer";
        } else {
            callback(data);
        }
    }
    if (method) {
        var reader = new FileReader();

        reader["onloadend"] = function() {
            callback(reader["result"]);
        };
        reader[method]( _toBlob(data, mime) );
    }
}

function WMCache_clean() {
    this._storage["clean"]();
}

function WMCache_profile() {
    if (WMCacheProfile) {
        WMCacheProfile["dump"](this);
    }
}

function WMCache_quota(callback) { // @arg Function - callback(used:Integer, quota:Integer):void
                                   // @desc get disk quota.
    callback = callback || function(used, quota) {
        console.log((used  / 1024 / 1024).toFixed(1) + "MB",
                    (quota / 1024 / 1024).toFixed(1) + "MB");
    };

    if (temporaryStorage && temporaryStorage["queryUsageAndQuota"]) {
        temporaryStorage["queryUsageAndQuota"](callback);
    } else {
        callback(0, 0);
    }
}

// --- validate / assertions -------------------------------
//{@dev
function $valid(val, fn, hint) { if (global["Valid"]) { global["Valid"](val, fn, hint); } }
function $type(obj, type) { return global["Valid"] ? global["Valid"].type(obj, type) : true; }
function $keys(obj, str) { return global["Valid"] ? global["Valid"].keys(obj, str) : true; }
//function $some(val, str, ignore) { return global["Valid"] ? global["Valid"].some(val, str, ignore) : true; }
//function $args(fn, args) { if (global["Valid"]) { global["Valid"].args(fn, args); } }
//}@dev

// --- exports ---------------------------------------------
if ("process" in global) {
    module["exports"] = WMCache;
}
global["WMCache" in global ? "WMCache_" : "WMCache"] = WMCache; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule

