(function(global) {
"use strict";

// --- dependency modules ----------------------------------
// Indexed Database API- http://www.w3.org/TR/IndexedDB/

var indexedDB = global["indexedDB"] || global["webkitIndexedDB"];

// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
//var _runOnBrowser = "document" in global;
var OBJECT_STORE = { "keyPath": "id", "autoIncrement": false };

// --- class / interfaces ----------------------------------
function WMIndexedDBStorage(name,            // @arg String - application name
                            callback,        // @arg Function - ready callback():void
                            errorCallback) { // @arg Function - error callback(err:Error):void
    this._objName = name;
    this._dbname  = "WMIndexedDBStorage";
    this._db      = null; // IDBDatabase
    this._fileList = {};  // snapshot. { id: size, ... }
    this._errCallback = errorCallback;

    _init(this, callback);
}

WMIndexedDBStorage["ready"] = !!indexedDB;
WMIndexedDBStorage["prototype"] = {
    "constructor":  WMIndexedDBStorage,         // new WMIndexedDBStorage(name:String, callback:Function, errorCallback:Function)
    "has":          WMIndexedDBStorage_has,     // WMIndexedDBStorage#has(id:String):void
    "list":         WMIndexedDBStorage_list,    // WMIndexedDBStorage#list():void
    "drop":         WMIndexedDBStorage_drop,    // WMIndexedDBStorage#drop(id:String, callback:Function = null):void
    "store":        WMIndexedDBStorage_store,   // WMIndexedDBStorage#store(id:String, data:Blob|ArrayBuffer, mime:MimeTypeString, size:Integer, callback:Function):void
    "fetch":        WMIndexedDBStorage_fetch,   // WMIndexedDBStorage#fetch(id:String, callback:Function):void
    "clear":        WMIndexedDBStorage_clear,   // WMIndexedDBStorage#clear(callback:Function):void
    "clean":        WMIndexedDBStorage_clean    // WMIndexedDBStorage#clean():void
};

// --- implements ------------------------------------------
function _init(that, callback) {
    var request = indexedDB["open"](that._dbname); // (IDBRequest)

    request["onerror"] = that._errCallback;
    request["onsuccess"] = _ready;
    request["onupgradeneeded"] = _createObjectStore;

    function _createObjectStore() {
        if ([].slice.call(this["result"].objectStoreNames).indexOf(that._objName) >= 0) {
            this["result"]["deleteObjectStore"](that._objName);
        }
        this["result"]["createObjectStore"](that._objName, OBJECT_STORE);
    }
    function _ready() {
        that._db = this["result"];
        _makeList(that, callback);
    }
}

function WMIndexedDBStorage_has(id) {
    return id in this._fileList;
}

// SELECT id FROM table
function WMIndexedDBStorage_list() {
    return JSON.parse( JSON.stringify(this._fileList) );
}

function _makeList(that, callback) {
    var trans = that._db["transaction"](that._objName, "readonly");

  //trans["oncomplete"] = function(event) {};
    trans["onabort"] = that._errCallback;

    var store = trans["objectStore"](that._objName);
    var cursorRequest = store["openCursor"](); // all data

    cursorRequest["onerror"] = function(event) {
//{@dev
        // Maybe Indexeddb locked?
        console.log("WMIndexedDBStorage._makeList.cursorRequest.onerror: " + event.target.error.name);
//}@dev
        that._errCallback();
    };
    cursorRequest["onsuccess"] = function() {
        var r = this["result"];

        if (r) {
            that._fileList[ r["id"] ] = r["value"]["size"];
            r["continue"]();
        } else {
            callback();
        }
    };
}

// INSERT OR REPLACE INTO table VALUES(id, blob)
function WMIndexedDBStorage_store(id,         // @arg String
                                  data,       // @arg ArrayBuffer
                                  mime,       // @arg MimeTypeString
                                  size,       // @arg Integer
                                  callback) { // @arg Function - callback(code:HTTPStatusCode):void
    var trans = this._db["transaction"](this._objName, "readwrite");
    trans["oncomplete"] = function() {
        callback(200);
    };
    trans["onabort"] = function(event) {
        // handle QuotaExceededError
        if (event.target.error.name === "QuotaExceededError") {
            callback(413);
        } else {
            callback(503);
        }
    };

    var store = trans["objectStore"](this._objName);
    var request = store["put"]({
            "id":   id,   // String
            "data": data, // Blob|ArrayBuffer
            "mime": mime, // String
            "size": size  // Integer
        });
    this._fileList[id] = size; // update snapshot
}

// SELECT blob FROM table WHERE id = id
function WMIndexedDBStorage_fetch(id, callback) {
    var trans = this._db["transaction"](this._objName, "readonly");
    var store = trans["objectStore"](this._objName);
    var request = store["get"](id);

    request["onerror"] = this._errCallback;
    request["onsuccess"] = function() {
        var r = this["result"];
        callback(r["data"],  // Blob|ArrayBuffer
                 r["mime"],  // String
                 r["size"]); // Integer
    };
}

function WMIndexedDBStorage_drop(id, callback) {
    var trans = this._db["transaction"](this._objName, "readwrite");
    var store = trans["objectStore"](this._objName);
    var request = store["delete"](id);

    request["onerror"] = this._errCallback;
    request["onsuccess"] = callback || function() {};
    delete this._fileList[id]; // update snapshot
}

function WMIndexedDBStorage_clear(callback) {
    var that = this;
    var trans = this._db["transaction"](this._objName, "readwrite");
    var store = trans["objectStore"](this._objName);
    var request = store["clear"]();

    request["onerror"] = this._errCallback;
    request["onsuccess"] = function() {
        that._fileList = {}; // update snapshot
        callback();
    };
}

function WMIndexedDBStorage_clean() {
    indexedDB["deleteDatabase"](this._dbname);
}

// --- validate / assertions -------------------------------
//{@dev
//function $valid(val, fn, hint) { if (global["Valid"]) { global["Valid"](val, fn, hint); } }
//function $type(obj, type) { return global["Valid"] ? global["Valid"].type(obj, type) : true; }
//function $keys(obj, str) { return global["Valid"] ? global["Valid"].keys(obj, str) : true; }
//function $some(val, str, ignore) { return global["Valid"] ? global["Valid"].some(val, str, ignore) : true; }
//function $args(fn, args) { if (global["Valid"]) { global["Valid"].args(fn, args); } }
//}@dev

// --- exports ---------------------------------------------
if ("process" in global) {
    module["exports"] = WMIndexedDBStorage;
}
global["WMIndexedDBStorage" in global ? "WMIndexedDBStorage_"
                                      : "WMIndexedDBStorage"] = WMIndexedDBStorage; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule

