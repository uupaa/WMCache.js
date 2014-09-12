(function(global) {
"use strict";

// --- dependency modules ----------------------------------
// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
//var _runOnBrowser = "document" in global;

// --- class / interfaces ----------------------------------
function WMBlackholeStorage(name, callback /*, errorCallback */) {
    callback();
}

WMBlackholeStorage["ready"] = true;
WMBlackholeStorage["prototype"] = {
    "constructor":  WMBlackholeStorage,       // new WMBlackholeStorage(param:Object, callback:Function, errorCallback:Function)
    "has":          WMBlackholeStorage_has,   // WMBlackholeStorage#has(key:String):void
    "list":         WMBlackholeStorage_list,  // WMBlackholeStorage#list():void
    "drop":         WMBlackholeStorage_drop,  // WMBlackholeStorage#drop(key:String, callback:Function = null):void
    "store":        WMBlackholeStorage_store, // WMBlackholeStorage#store(key:String, blob:Blob, mime:String, size:Integer, callback:Function = null):void
    "fetch":        WMBlackholeStorage_fetch, // WMBlackholeStorage#fetch(key:String, callback:Function):void
    "clear":        WMBlackholeStorage_clear, // WMBlackholeStorage#clear(callback:Function):void
    "clean":        WMBlackholeStorage_clean  // WMBlackholeStorage#clean():void
};

// --- implements ------------------------------------------
function WMBlackholeStorage_has(/* key */) {
    return false;
}

function WMBlackholeStorage_list() {
    return {};
}

function WMBlackholeStorage_store(key, blob, mime, size, callback) {
    if (callback) { callback(); }
}

function WMBlackholeStorage_fetch(key, callback) {
    callback();
}

function WMBlackholeStorage_drop(key, callback) {
    if (callback) { callback(); }
}

function WMBlackholeStorage_clear(callback) {
    callback();
}

function WMBlackholeStorage_clean() {
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
    module["exports"] = WMBlackholeStorage;
}
global["WMBlackholeStorage" in global ? "WMBlackholeStorage_"
                                      : "WMBlackholeStorage"] = WMBlackholeStorage; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule

