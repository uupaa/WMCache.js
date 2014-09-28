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
    this._size    = 0;    // total size
    this._fileList = {};  // snapshot. { id: size, ... }
    this._errCallback = errorCallback;
    this._grantedBytes = 0;

    _init(this, callback);
}

WMFileSystemStorage["ready"] = !!requestFileSystem;
WMFileSystemStorage["prototype"] = {
    "constructor":  WMFileSystemStorage,        // new WMFileSystemStorage(param:Object, callback:Function, errorCallback:Function)
    "has":          WMFileSystemStorage_has,    // WMFileSystemStorage#has(id:String):void
    "list":         WMFileSystemStorage_list,   // WMFileSystemStorage#list():void
    "size":         WMFileSystemStorage_size,   // WMFileSystemStorage#size():Integer
    "drop":         WMFileSystemStorage_drop,   // WMFileSystemStorage#drop(id:String, callback:Function = null):void
    "store":        WMFileSystemStorage_store,  // WMFileSystemStorage#store(id:String, blob:Blob, mime:MimeTypeString, size:Integer, callback:Function):void
    "fetch":        WMFileSystemStorage_fetch,  // WMFileSystemStorage#fetch(id:String, callback:Function):void
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

function WMFileSystemStorage_has(id) {
    return id in this._fileList;
}

// read directory entries
function WMFileSystemStorage_list() {
    return JSON.parse( JSON.stringify(this._fileList) );
}

function WMFileSystemStorage_size() {
    return this._size;
}

function _makeList(that, callback) {
    var dirReader = that._dir["createReader"]();
    var ids = [];

    _list();

    function _list() {
        dirReader["readEntries"](function(fileEntries) {
            var iz = fileEntries.length;

            if (iz) {
                for (var i = 0; i < iz; ++i) {
                    if (fileEntries[i]["isFile"]) {
                        ids.push( fileEntries[i]["name"] ); // encoded file path
                    }
                }
                _list(); // recursive call
            } else {
                _finished();
            }
        }, that._errCallback);
    }

    function _finished() {
        var task = new Task(ids.length, callback);
        var missfn = task["missfn"]();

        for (var i = 0, iz = ids.length; i < iz; ++i) {
            that._dir["getFile"](ids[i], {}, _getFileSize, missfn);
        }

        function _getFileSize(fileEntry) {
            fileEntry["file"](function(file) {
                var id = decodeURIComponent(file["name"]); // decode

                _updateFileList(that, id, true, file["size"]);
                task["pass"]();
            }, missfn);
        }
    }
}

// put file
function WMFileSystemStorage_store(id,         // @arg String
                                   blob,       // @arg Blob
                                   mime,       // @arg MimeTypeString
                                   size,       // @arg Integer
                                   callback) { // @arg Function - callback(code:HTTPStatusCode):void
    var that = this;
    var fileName = encodeURIComponent(id);
    var ERROR_CODES = { "QuotaExceededError": 413, "InvalidStateError": 503 };

    this._dir["getFile"](fileName, { "create": true }, function(fileEntry) {
        fileEntry["createWriter"](function(fileWriter) {
            var code = 0;

            // success: onwritestart -> onwrite -> onwriteend
            // fail:    onwritestart -> onerror -> onwriteend
            fileWriter["onwrite"] = function() { code = 200; };
            fileWriter["onerror"] = function(event) {
                code = ERROR_CODES[event.target.error.name] || 503;
            };
            fileWriter["onwriteend"] = function() {
                if (code === 200) {
                    _updateFileList(that, id, true, size);
                } else { // code 0, code 413, code 503
                    _updateFileList(that, id);
                    fileEntry["remove"](function() {}); // remove wreckage (zero byte file)
                }
                callback(code);
            };
            fileWriter["write"](blob);
        });
    }, function(error) { // FileError { name, message }
        _updateFileList(that, id);
        callback( ERROR_CODES[error.name] || 503 );
    });
}

function _updateFileList(that, id, update, size) {
    if (id in that._fileList) { // already exists?
        that._size -= that._fileList[id]; // subtract
        if (that._size < 0) {
            that._size = 0;
        }
    }
    if (update) {
        that._size += size;
        that._fileList[id] = size; // add or update
    } else {
        delete that._fileList[id]; // remove
    }
}

// read file
function WMFileSystemStorage_fetch(id, callback) {
    var that = this;
    var fileName = encodeURIComponent(id);

    this._dir["getFile"](fileName, {}, function(fileEntry) {
        fileEntry["file"](function(file) {
            callback(file, file["type"], file["size"]);
        }, that._errCallback);
    }, that._errCallback);
}

// drop file
function WMFileSystemStorage_drop(id, callback) {
    var that = this;
    var fileName = encodeURIComponent(id);

    this._dir["getFile"](fileName, { "create": false }, function(fileEntry) {
        _updateFileList(that, id);
        fileEntry["remove"](callback || function() {}, that._errCallback);
    }, function(err) {
        _updateFileList(that, id);
        if (err.name === "NotFoundError") { // [!] adhoc code for Chrome
            callback();
        } else {
            that._errCallback(err);
        }
    });
}

// drop all files (include dot file)
function WMFileSystemStorage_clear(callback) {
    var that = this;
    var keys = Object.keys(this._fileList);
    var task = new Task(keys.length, function() {
            that._size = 0;
            that._fileList = {};
            callback();
        });
    var passfn = task["passfn"]();

    for (var id in this._fileList) {
        this["drop"](id, passfn);
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

