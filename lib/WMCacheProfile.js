//{@WMCacheProfile
(function(global) {
"use strict";

// --- dependency modules ----------------------------------
// Quota Management API - http://www.w3.org/TR/quota-api/
// Working with quota on mobile browsers - http://www.html5rocks.com/en/tutorials/offline/quota-research/
var Task = global["Task"];
var temporaryStorage = navigator["temporaryStorage"] ||
                       navigator["webkitTemporaryStorage"];

// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
//var _runOnBrowser = "document" in global;

// --- class / interfaces ----------------------------------
function WMCacheProfile() {
}

WMCacheProfile["get"]  = WMCacheProfile_get;
WMCacheProfile["dump"] = WMCacheProfile_dump;

// --- implements ------------------------------------------
function WMCacheProfile_get(cache,      // @arg WMCache
                            callback) { // @arg Function = null - callback(info:Object):void
                                        // @info.L2_MAP Object - { key: size, ... }
                                        // @info.L2_USED Integer - L2 used bytes. storage payload
                                        // @info.STORAGE_USED Integer - Storage used bytes.
                                        // @info.STORAGE_QUOTA Integer - Storage quota(cap) bytes.
                                        // @ret this
                                        // @desc get L1, L2 and temporary disk quota.
    var task = new Task(2, function(err, buffer) {
            if (callback) {
                callback(buffer);
            }
        });
    var map = cache["list"]();

    if (global.chrome) {
        _chromeDevToolsProfile(map);
    }
    _collectStorageData(map);
    _collectDiskQuotaData();

    function _chromeDevToolsProfile(map) {
        // https://developer.chrome.com/devtools/docs/console#marking-the-timeline
        console.time("cache fetch elapsed");
        console.timeline("cache");
        //console.profile("CPU prifile");
        var keys = Object.keys(map);
        var fetchTask = new Task(keys.length, function() {
                setTimeout(function() {
                    //console.profileEnd("CPU prifile");
                    console.timelineEnd("cache");
                    console.timeEnd("cache fetch elapsed");
                }, 20);
            });
        keys.forEach(function(key, index) {
            cache.get(key, function() {
                console.timeStamp(index);
                fetchTask.pass();
            });
        });
    }

    function _collectStorageData(map) {
        var used = 0;
        for (var key in map) {
            used += map[key];
        }
        task["set"]("L2_MAP",  map);
        task["set"]("L2_USED", used);
        task["pass"]();
    }

    function _collectDiskQuotaData() {
        if (temporaryStorage && temporaryStorage["queryUsageAndQuota"]) {
            temporaryStorage["queryUsageAndQuota"](function(used, quota) {
                task["set"]("STORAGE_USED",  used);
                task["set"]("STORAGE_QUOTA", quota);
                task["pass"]();
            });
        } else {
            task["pass"]();
        }
    }
}

function WMCacheProfile_dump(cache) { // @arg WMCache
    WMCacheProfile_get(cache, function(info) {
        if (global.chrome) {
            console.table(_table(info.L2_MAP));
            console.table({
                L2:      { USED: unit(info.L2_USED),      QUOTA: "NO DATA" },
                STORAGE: { USED: unit(info.STORAGE_USED), QUOTA: unit(info.STORAGE_QUOTA) }
            });
        } else {
            console.dir(info.L2_MAP);
            console.dir({
                L2:      { USED: unit(info.L2_USED),      QUOTA: "NO DATA" },
                STORAGE: { USED: unit(info.STORAGE_USED), QUOTA: unit(info.STORAGE_QUOTA) }
            });
        }
    });

    function _table(map) {
        var result = [];
        for (var key in map) {
            result.push({ KEY: key, SIZE: map[key] });
        }
        return result;
    }
    function unit(n) {
        n = n || 0;

        if (n < 1024) {
            return (n.toString()).slice(-6) + "B";
        }
        if (n < 1024 * 1024) {
            return ((n / 1024).toFixed(1)).slice(-6) + "KB (" + n + ")";
        }
        if (n < 1024 * 1024 * 1024) {
            return ((n / 1024 / 1024).toFixed(1)).slice(-6) + "MB (" + n + ")";
        }
        return ((n / 1024 / 1024 / 1023).toFixed(1)).slice(-6) + "GB (" + n + ")";
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
    module["exports"] = WMCacheProfile;
}
global["WMCacheProfile" in global ? "WMCacheProfile_"
                                  : "WMCacheProfile"] = WMCacheProfile; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule
//}@WMCacheProfile

