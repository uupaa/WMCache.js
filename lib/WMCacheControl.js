(function(global) {
"use strict";

// --- dependency modules ----------------------------------
var WMURL = global["WMURL"];

// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
//var _runOnBrowser = "document" in global;
var PATH_NORMALIZE = /^\.\//; // "./a.png" -> "a.png"
var DOT_FILE       = /^\.[^\.\/]/; // ".a.png" Dotfiles was excluded from garbage collection.

// --- class / interfaces ----------------------------------
function WMCacheControl(allow,     // @arg URLStringArray = []
                        deny,      // @arg URLStringArray = []
                        garbage) { // @arg URLStringArray = []
//{@dev
    $valid($type(allow,   "URLStringArray|omit"), WMCacheControl, "allow");
    $valid($type(deny,    "URLStringArray|omit"), WMCacheControl, "deny");
    $valid($type(garbage, "URLStringArray|omit"), WMCacheControl, "garbage");
//}@dev

    this._allow   = (allow   || []).map(_normalize);
    this._deny    = (deny    || []).map(_normalize);
    this._garbage = (garbage || []).map(_normalize);
}

WMCacheControl["prototype"]["isDrop"]  = WMCacheControl_isDrop;  // WMCacheControl#isDrop(url:URLString):Boolean
WMCacheControl["prototype"]["isStore"] = WMCacheControl_isStore; // WMCacheControl#isStore(url:URLString):Boolean
WMCacheControl["prototype"]["gc"]      = WMCacheControl_gc;      // WMCacheControl#gc(cache:WMCache):void

// --- implements ------------------------------------------
function _normalize(url) {
    return url.replace(PATH_NORMALIZE, "");
}

function WMCacheControl_isDrop(url) { // @arg URLString
                                      // @ret Boolean
    return !this["isStore"](url);
}

function WMCacheControl_isStore(url) { // @arg URLString
                                       // @ret Boolean
    url = _normalize(url);

    var allow = this._allow;
    var deny  = this._deny;

/*

| deny.length | allow.length | do cache                                                        |
|-------------|--------------|-----------------------------------------------------------------|
|  0          |  0           | cache all URLs                                                  |
| !0          |  0           | cache URLs, but exclude if matched deny pattern                 |
|  0          | !0           | cache if matched allow pattern, do not cache otherwise          |
| !0          | !0           | cache if matched allow pattern, exclude if matched deny pattern |

- in japanese
    - deny が無く allow も無い場合は、全てキャッシュする
    - deny があり allow が無い場合は、キャッシュするが deny に一致するURLはキャッシュしない
    - deny が無く allow がある場合は、allow に一致するURLをキャッシュし、それ以外はキャッシュしない
    - deny があり allow もある場合は、allow に一致するURLをキャッシュし、deny に一致するURLはキャッシュしない

 */

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

function WMCacheControl_gc(cache) { // @arg WMCache
    var list = cache["list"](); // { url: size, ... }
    var target = [];
    var gz = this._garbage.length;

    if (gz) {
        // garbage が指定されている場合は、
        // パターンにマッチする url を削除する。
        // ただし、先頭がドットで始まる dotfiles は削除しない
        for (var url in list) {
            if ( !DOT_FILE.test(url) ) {
                for (var i = 0; i < gz; ++i) {
                    if (WMURL["match"](this._garbage[i], url)) {
                        target.push(url);
                    }
                }
            }
        }
    } else {
        // garbage が指定されていない場合は、
        // 全ての url を削除対象とする。
        // ただし、先頭がドットで始まる dotfiles は削除しない
        for (var url in list) {
            if ( !DOT_FILE.test(url) ) {
                target.push(url);
            }
        }
    }
    target.forEach(function(url) {
        cache["drop"](url);
    });
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

