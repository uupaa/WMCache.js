(function(global) {
"use strict";

// --- dependency modules ----------------------------------
var WMCacheControl = global["WMCacheControl"]; // allow and deny control
var WMCacheProfile = global["WMCacheProfile"]; // DevTools profiler
var URL = global["URL"] || global["webkitURL"];
var FS = global["WMFileSystemStorage"]; // FileSystem backend
var DB = global["WMIndexedDBStorage"];  // IndexedDB backend
var BH = global["WMBlackholeStorage"];  // Blackhole backend

// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
//var _runOnBrowser = "document" in global;
var REL_PATH_NORMALIZE = /^\.\//; // "./a.png" -> "a.png"

// --- class / interfaces ----------------------------------
function WMCache(param,         // @arg Object - { name, deny, allow }
                 callback,      // @arg Function - cache ready callback(cache:WMCache):void
                 errCallback) { // @arg Function - error callback(err:Error):void
                                // @param.name String = "void" - application name
                                // @param.deny URLStringArray = [] - deny URL pattern
                                // @param.allow URLStringArray = [] - allow URL pattern
    param = param || {};

//{@dev
    $valid($type(param,       "Object"),              WMCache, "param");
    $valid($type(callback,    "Function"),            WMCache, "callback");
    $valid($type(errCallback, "Function"),            WMCache, "errCallback");
    $valid($keys(param,       "name|deny|allow"),     WMCache, "param");
    $valid($type(param.name,  "String|omit"),         WMCache, "param.name");
    $valid($type(param.deny,  "URLStringArray|omit"), WMCache, "param.deny");
    $valid($type(param.allow, "URLStringArray|omit"), WMCache, "param.allow");
//}@dev

    var that  = this;
    var name  = param["name"]  || "void";
    var deny  = param["deny"]  || [];
    var allow = param["allow"] || [];

    this._errCallback = errCallback;
    this._control = new WMCacheControl(allow, deny);
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
    "has":           WMCache_has,           // WMCache#has(url:URLString):Boolean
    "get":           WMCache_get,           // WMCache#get(url:URLString, callback:Function, options:Object = {}):void
    "list":          WMCache_list,          // WMCache#list():Object - { key: size, ... }
    "drop":          WMCache_drop,          // WMCache#drop(url:URLString, callback:Function = null):void
    "clear":         WMCache_clear,         // WMCache#clear(callback:Function = null):void
    "gc":            WMCache_gc,            // WMCache#gc():void
    // --- convenient ---
    "getBlob":       WMCache_getBlob,       // WMCache#getBlob(url:URLString, callback:Function, options:Object = {}):void
    "getBlobURL":    WMCache_getBlobURL,    // WMCache#getBlobURL(url:URLString, callback:Function, options:Object = {}):void
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
                     callback,  // @arg Function - callback(url:URLString, data:Blob|ArrayBuffer|null, mime:String, size:Integer, cached:Boolean):void
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
                callback(url, null, "", 0, false); // error
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
                that._storage["store"](key, data, mime, size, function() {
                    // Wait for completion of writing.
                    callback(url, data, mime, size, false);
                });
            } else {
                that._storage["store"](key, data, mime, size);
                    // Not wait for completion of writing.
                    callback(url, data, mime, size, false);
            }
        } else {
            callback(url, data, mime, size, false);
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

function WMCache_clear(callback) { // @arg Function = null - callback():void
//{@dev
    $valid($type(callback, "Function|omit"), WMCache_clear, "callback");
//}@dev

    this._storage["clear"](callback || function() {});
}

function WMCache_gc() { // @desc Drop unnecessary cache.
    for (var key in this._storage["list"]()) {
        if (this._control["isDrop"](key)) {
            this._storage["drop"](key);
        }
    }
}

function WMCache_getBlob(url,       // @arg URLString
                         callback,  // @arg Function - callback(url:URLString, blob:Blob, mime:String, size:Integer, cached:Boolean):void
                         options) { // @arg Object = {} - { reget, cors, wait }
    this["get"](url, function(url, data, mime, size, cached) {
        if (data instanceof ArrayBuffer) {
            callback(url, new Blob([data], { "type": mime }), mime, size, cached);
        } else if (data instanceof Blob) {
            callback(url, data, mime, size, cached);
        }
    }, options);
}

function WMCache_getBlobURL(url,       // @arg URLString
                            callback,  // @arg Function - callback(url:URLString, blobURL:BlobURLString, mime:String, size:Integer, cached:Boolean):void
                            options) { // @arg Object = {} - { reget, cors, wait }
    this["get"](url, function(url, data, mime, size, cached) {
        if (data instanceof ArrayBuffer) {
            var blob = new Blob([data], { "type": mime });
            callback(url, URL["createObjectURL"](blob), mime, size, cached);
        } else if (data instanceof Blob) {
            callback(url, URL["createObjectURL"](data), mime, size, cached);
        }
    }, options);
}

function WMCache_getArrayBuffer(url,       // @arg URLString
                                callback,  // @arg Function - callback(url:URLString, buffer:ArrayBuffer, mime:String, size:Integer, cached:Boolean):void
                                options) { // @arg Object = {} - { reget, cors, wait }
    this["get"](url, function(url, data, mime, size, cached) {
        if (data instanceof ArrayBuffer) {
            callback(url, data, mime, size, cached);
        } else if (data instanceof Blob) {
            var reader = new FileReader();
            reader["onloadend"] = function() {
                callback(url, reader["result"], mime, size, cached);
            };
            reader["readAsArrayBuffer"](data);
        }
    }, options);
}

function WMCache_clean() {
    this._storage["clean"]();
}

function WMCache_profile() {
    if (WMCacheProfile) {
        WMCacheProfile["dump"](this);
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

