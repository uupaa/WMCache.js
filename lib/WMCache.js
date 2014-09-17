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
var REL_PATH_NORMALIZE = /^\.\//; // "./a.png" -> "a.png"

// --- class / interfaces ----------------------------------
function WMCache(param,         // @arg Object - { name, deny, allow, garbage }
                 callback,      // @arg Function - cache ready callback(cache:WMCache, backend:StorageString):void
                 errCallback) { // @arg Function - error callback(err:Error):void
                                // @param.name String = "void" - application name
                                // @param.deny URLStringArray = [] - deny URL pattern
                                // @param.allow URLStringArray = [] - allow URL pattern
                                // @param.garbage URLStringArray = [] - garbage URL pattern
    param = param || {};

//{@dev
    $valid($type(param,       "Object"),              WMCache, "param");
    $valid($type(callback,    "Function"),            WMCache, "callback");
    $valid($type(errCallback, "Function"),            WMCache, "errCallback");
    $valid($keys(param,       "name|deny|allow|garbage"), WMCache, "param");
    $valid($type(param.name,  "String|omit"),         WMCache, "param.name");
    $valid($type(param.deny,  "URLStringArray|omit"), WMCache, "param.deny");
    $valid($type(param.allow, "URLStringArray|omit"), WMCache, "param.allow");
    $valid($type(param.garbage, "URLStringArray|omit"), WMCache, "param.garbage");
//}@dev

    var that = this;
    var name = param["name"] || "void";
    var deny = param["deny"] || [];
    var allow = param["allow"] || [];
    var garbage = param["garbage"] || [];

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
    // --- download and cache ---
    "has":           WMCache_has,           // WMCache#has(url:URLString):Boolean
    "get":           WMCache_get,           // WMCache#get(url:URLString, callback:Function, options:Object = {}):void
    "list":          WMCache_list,          // WMCache#list():Object - { key: size, ... }
    "drop":          WMCache_drop,          // WMCache#drop(url:URLString, callback:Function = null):void
    "clear":         WMCache_clear,         // WMCache#clear(callback:Function = null):void
    "quota":         WMCache_quota,         // WMCache#quota(callback:Function):void
    "gc":            WMCache_gc,            // WMCache#gc(all:Boolean = false):void
    // --- temporary storage ---
    "store":         WMCache_store,         // WMCache#store(id:IDString, data:Blob|ArrayBuffer, mime:MimeTypeString, size:Integer, callback:Function):void
    "fetch":         WMCache_fetch,         // WMCache#fetch(id:IDString, callback:Function):void
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

    return this._storage["has"](url.replace(REL_PATH_NORMALIZE, ""));
}

function WMCache_get(url,       // @arg URLString
                     callback,  // @arg Function - callback(url:URLString, data:Blob|ArrayBuffer|null, mime:MimeTypeString, size:Integer, cached:Boolean):void
                     options) { // @arg Object = {} - { reget, cors, wait }
                                // @options.reget Boolean = false - force re-download from server.
                                // @options.cors Boolean = false - withCredentials value.
                                // @options.wait Boolean = false - wait for completion of writing.
                                // @desc get URL and store cache
//{@dev
    $valid($type(url,      "URLString"), WMCache_get, "url");
    $valid($type(callback, "Function"),  WMCache_get, "callback");
//}@dev

    options = options || {};

//{@dev
    $valid($type(options.reget, "Boolean|omit"), WMCache_get, "options.reget");
    $valid($type(options.cors,  "Boolean|omit"), WMCache_get, "options.cors");
//}@dev

    var that = this;
    var key = url.replace(REL_PATH_NORMALIZE, "");

    if ( options["reget"] || !this._storage["has"](key) ) { // download?
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
        this._storage["fetch"](key, function(data, mime, size) {
            callback(url, data, mime, size, true);
        });
    }

    function _loaded(data, mime, size) {
        if ( that._control["isStore"](url) ) {
            if (options["wait"]) {
                that._storage["store"](key, data, mime, size, function(code) {
                    _handleStatusCode(code);
                    // Wait for completion of writing.
                    callback(url, data, mime, size, false);
                });
            } else {
                that._storage["store"](key, data, mime, size, _handleStatusCode);
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
                  that["gc"]();
                  break;
        case 503: console.log("WriteError");
        }
    }
}

function WMCache_list() { // @ret Object - { key: size, ... }
    return this._storage["list"]();
}

function WMCache_drop(url,        // @arg URLString
                      callback) { // @arg Function = null - callback():void
                                  // @ret Object - { key: size, ... }
    var key = url.replace(REL_PATH_NORMALIZE, "");

    this._storage["drop"](key, callback || function() {});
}

function WMCache_store(id,         // @arg IDString
                       data,       // @arg Blob|ArrayBuffer
                       mime,       // @arg MimeTypeString
                       size,       // @arg Integer
                       callback) { // @arg Function = null - callback(id:IDString, code:HTTPStatusCode, stored:Boolean):void
//{@dev
    $valid($type(id,       "IDString"),         WMCache_store, "id");
    $valid($type(data,     "Blob|ArrayBuffer"), WMCache_store, "data");
    $valid($type(mime,     "MimeTypeString"),   WMCache_store, "mime");
    $valid($type(size,     "Integer"),          WMCache_store, "size");
    $valid($type(callback, "Function|omit"),    WMCache_store, "callback");
//}@dev

    callback = callback || function() {};

    var that = this;
    var to = this._storage instanceof FS ? "blob" :
             this._storage instanceof DB ? "arraybuffer" : "";

    if ( !to || this._control["isDrop"](id) ) {
        callback(id, 204, false); // fake response
    } else {
        _convert(data, to, mime, function(result) {
            that._storage["store"](id, result, mime, size, function(code) {
                callback(id, code, true); // stored
            });
        });
    }
}

function WMCache_fetch(id,         // @arg IDString
                       callback) { // @arg Function - callback(id:IDString, data:Blob|ArrayBuffer|null, mime:MimeTypeString, size:Integer, cached:Boolean):void
//{@dev
    $valid($type(id,       "IDString"),      WMCache_fetch, "id");
    $valid($type(callback, "Function|omit"), WMCache_fetch, "callback");
//}@dev

    if ( this._storage["has"](id) ) {
        this._storage["fetch"](id, function(data, mime, size) {
            callback(id, data, mime, size, true);
        });
    } else {
        callback(id, null, "", 0, false); // 404
    }
}

function WMCache_clear(callback) { // @arg Function = null - callback():void
//{@dev
    $valid($type(callback, "Function|omit"), WMCache_clear, "callback");
//}@dev

    this._storage["clear"](callback || function() {});
}

function WMCache_gc(all) { // @arg Boolean = false
                           // @desc Drop unnecessary cache.
//{@dev
    $valid($type(all, "Boolean|omit"), WMCache_gc, "all");
//}@dev

    this._control["gc"](all || false);
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
                         callback,  // @arg Function - callback(url:URLString, blob:Blob, mime:String, size:Integer, cached:Boolean):void
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

