(function(global) {
"use strict";

// --- dependency modules ----------------------------------
var WMURL = global["WMURL"];

// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
//var _runOnBrowser = "document" in global;

// --- class / interfaces ----------------------------------
function WMCacheControl(allow,  // @arg URLStringArray = []
                        deny) { // @arg URLStringArray = []
//{@dev
    $valid($type(allow, "URLStringArray|omit"), WMCacheControl, "allow");
    $valid($type(deny,  "URLStringArray|omit"), WMCacheControl, "deny");
//}@dev

    this._allow = allow || [];
    this._deny  = deny  || [];
}

WMCacheControl["prototype"]["isDrop"]  = WMCacheControl_isDrop;  // WMCacheControl#isDrop(url:URLString):Boolean
WMCacheControl["prototype"]["isStore"] = WMCacheControl_isStore; // WMCacheControl#isStore(url:URLString):Boolean

// --- implements ------------------------------------------
function WMCacheControl_isDrop(url) { // @arg URLString
                                      // @ret Boolean
    return !this["isStore"](url);
}

function WMCacheControl_isStore(url) { // @arg URLString
                                       // @ret Boolean
    var allow = this._allow;
    var deny  = this._deny;

    // deny が無く allow も無い場合は、全てキャッシュする
    // deny があり allow が無い場合は deny  に一致するURLはキャッシュしない。それ以外はキャッシュする
    // deny が無く allow がある場合は allow に一致するURLをキャッシュする。それ以外はキャッシュしない
    // deny があり allow もある場合は deny  に一致するURLはキャッシュしない。allow に一致するURLはキャッシュする
    if (allow.length && deny.length) {
        return !_isDeny() && _isAllow();
    } else if (allow.length) {
        return _isAllow();
    } else if (deny.length) {
        return !_isDeny();
    }
    return true;

    function _isAllow() {
        for (var i = 0, iz = allow.length; i < iz; ++i) {
            if (WMURL["match"](allow[i], url)) {
                return true;
            }
        }
        return false;
    }
    function _isDeny() {
        for (var i = 0, iz = deny.length; i < iz; ++i) {
            if (WMURL["match"](deny[i], url)) {
                return true;
            }
        }
        return false;
    }
}

// --- validate / assertions -------------------------------
//{@dev
function $valid(val, fn, hint) { if (global["Valid"]) { global["Valid"](val, fn, hint); } }
function $type(obj, type) { return global["Valid"] ? global["Valid"].type(obj, type) : true; }
//function $keys(obj, str) { return global["Valid"] ? global["Valid"].keys(obj, str) : true; }
//function $some(val, str, ignore) { return global["Valid"] ? global["Valid"].some(val, str, ignore) : true; }
//function $args(fn, args) { if (global["Valid"]) { global["Valid"].args(fn, args); } }
//}@dev

// --- exports ---------------------------------------------
if ("process" in global) {
    module["exports"] = WMCacheControl;
}
global["WMCacheControl" in global ? "WMCacheControl_"
                                  : "WMCacheControl"] = WMCacheControl; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule

