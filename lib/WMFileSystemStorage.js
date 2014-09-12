(function(global) {
"use strict";

// --- dependency modules ----------------------------------
// Exploring the FileSystem APIs - http://www.html5rocks.com/en/tutorials/file/filesystem/

var Task = global["Task"];
var requestFileSystem = global["requestFileSystem"] ||
                        global["webkitRequestFileSystem"];
var temporaryStorage = navigator["temporaryStorage"] ||
                       navigator["webkitTemporaryStorage"];

// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
//var _runOnBrowser = "document" in global;
var REQUEST_QUOTA_BYTES = 100 * 1024 * 1024; // 100MB

// --- class / interfaces ----------------------------------
function WMFileSystemStorage(name,            // @arg String - application name
                             callback,        // @arg Function - ready callback():void
                             errorCallback) { // @arg Function - error callback(err:Error):void
    this._dirName = name;
    this._fs      = null; // FileSystem
    this._dir     = null; // DirEntry
    this._fileList = {};  // snapshot. { key: size, ... }
    this._errCallback = errorCallback;
    this._grantedBytes = 0;

    _init(this, callback);
}

WMFileSystemStorage["ready"] = !!requestFileSystem;
WMFileSystemStorage["prototype"] = {
    "constructor":  WMFileSystemStorage,        // new WMFileSystemStorage(param:Object, callback:Function, errorCallback:Function)
    "has":          WMFileSystemStorage_has,    // WMFileSystemStorage#has(key:String):void
    "list":         WMFileSystemStorage_list,   // WMFileSystemStorage#list():void
    "drop":         WMFileSystemStorage_drop,   // WMFileSystemStorage#drop(key:String, callback:Function = null):void
    "store":        WMFileSystemStorage_store,  // WMFileSystemStorage#store(key:String, blob:Blob, mime:String, size:Integer, callback:Function = null):void
    "fetch":        WMFileSystemStorage_fetch,  // WMFileSystemStorage#fetch(key:String, callback:Function):void
    "clear":        WMFileSystemStorage_clear,  // WMFileSystemStorage#clear(callback:Function):void
    "clean":        WMFileSystemStorage_clean,  // WMFileSystemStorage#clean():void
    // --- private ---
    "createDir":    private_createDir,          // #createDir(callback:Function):void
    "removeDir":    private_removeDir           // #removeDir(callback:Function):void
};

// --- implements ------------------------------------------
function _init(that, callback) {
    temporaryStorage["requestQuota"](REQUEST_QUOTA_BYTES, _quotaReady, that._errCallback);

    function _quotaReady(grantedBytes) {
        requestFileSystem(global["TEMPORARY"], grantedBytes, _ready, that._errCallback);
        that._grantedBytes = grantedBytes;
    }
    function _ready(fileSystem) {
        that._fs = fileSystem;
        that["createDir"](function() {
            _makeList(that, callback);
        });
    }
}

function WMFileSystemStorage_has(key) {
    return key in this._fileList;
}

// read directory entries
function WMFileSystemStorage_list() {
    return JSON.parse( JSON.stringify(this._fileList) );
}

function _makeList(that, callback) {
    that._fileList = {};

    var dirReader = that._dir["createReader"]();

    _list();

    function _list() {
        dirReader["readEntries"](function(fileEntries) {
            if (fileEntries.length) {
                for (var i = 0, iz = fileEntries.length; i < iz; ++i) {
                    var fileEntry = fileEntries[i];
                    var key = decodeURIComponent(fileEntry["name"]);

                    if (fileEntry["isFile"]) {
                        that._fileList[key] = 0; // add/update key
                    }
                }
                _list();
            } else {
                _getFileSize();
            }
        }, that._errCallback);
    }

    function _getFileSize() {
        var keys = Object.keys(that._fileList);
        var task = new Task(keys.length, callback);
        var missfn = task["missfn"]();

        for (var key in that._fileList) {
            var fileName = encodeURIComponent(key);

            that._dir["getFile"](fileName, {}, _getFile, missfn);
        }

        function _getFile(fileEntry) {
            fileEntry["file"](function(file) {
                var key = decodeURIComponent(file["name"]);

                that._fileList[key] = file["size"];
                task["pass"]();
            }, missfn);
        }
    }
}

// put file
function WMFileSystemStorage_store(key, blob, mime, size, callback) {
    var that = this;
    var fileName = encodeURIComponent(key);

    this._dir["getFile"](fileName, { "create": true }, function(fileEntry) {
        fileEntry["createWriter"](function(fileWriter) {
            that._fileList[key] = size; // update snapshot
            fileWriter["onwriteend"] = callback || null;
            fileWriter["onerror"] = that._errCallback; // -> QuotaExceededError
            fileWriter["write"](blob);
        });
    }, that._errCallback);
}

// read file
function WMFileSystemStorage_fetch(key, callback) {
    var that = this;
    var fileName = encodeURIComponent(key);

    this._dir["getFile"](fileName, {}, function(fileEntry) {
        fileEntry["file"](function(file) {
            callback(file, file["type"], file["size"]);
        }, that._errCallback);
    }, that._errCallback);
}

// drop file
function WMFileSystemStorage_drop(key, callback) {
    var that = this;
    var fileName = encodeURIComponent(key);

    this._dir["getFile"](fileName, { "create": false }, function(fileEntry) {
        delete that._fileList[key]; // update snapshot
        fileEntry["remove"](callback || function() {}, that._errCallback);
    }, function(err) {
        if (err.name === "NotFoundError") { // [!] adhoc code for Chrome
            callback();
        } else {
            that._errCallback(err);
        }
    });
}

// drop all files
function WMFileSystemStorage_clear(callback) {
    var keys = Object.keys(this._fileList);
    var task = new Task(keys.length, callback);
    var passfn = task["passfn"]();

    for (var key in this._fileList) {
        this["drop"](key, passfn);
    }
}

function WMFileSystemStorage_clean() {
    this["removeDir"](function() {}, this._errCallback);
}

function private_createDir(callback) {
    var that = this;

    that._fs["root"]["getDirectory"](that._dirName, { "create": true }, function(dirEntry) {
        that._dir = dirEntry;
        callback();
    }, that._errCallback);
}

function private_removeDir(callback) {
    var that = this;

    if (!that._dir) {
        that._fs["root"]["getDirectory"](that._dirName, {}, function(dirEntry) {
            that._dir = dirEntry;
            _removeDir(callback);
        }, that._errCallback);
    } else {
        _removeDir(callback);
    }

    function _removeDir(callback) {
        that._dir["removeRecursively"](function() {
            that._dir = null;
            callback();
        }, that._errCallback);
    }
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
    module["exports"] = WMFileSystemStorage;
}
global["WMFileSystemStorage" in global ? "WMFileSystemStorage_"
                                       : "WMFileSystemStorage"] = WMFileSystemStorage; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule

