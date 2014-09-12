// [UNDERCONSTRUCTION]
(function(global) {
"use strict";

// --- dependency modules ----------------------------------
var WMEvent  = global["WMEvent"]  || require("uupaa.wmevent.js");
var DataType = global["DataType"] || require("uupaa.datatype.js");
var WMURL    = global["WMURL"]    || require("uupaa.wmurl.js");
var http     = require("http");
var fs       = require("fs");

// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
var _runOnBrowser = "document" in global;

// readyState code -> http://www.w3.org/TR/XMLHttpRequest/
var READY_STATE_UNSENT           = 0;
var READY_STATE_OPENED           = 1;
var READY_STATE_HEADERS_RECEIVED = 2;
var READY_STATE_LOADING          = 3;
var READY_STATE_DONE             = 4;

// --- class / interfaces ----------------------------------
function WMXMLHttpRequest() {
    this._event = new WMEvent()["register"](
        "loadstart,load,loadend,progress,readystatechange,error,timeout".split(","));

    this._xhr = {
        "readyState":       READY_STATE_UNSENT,
        // --- request ---
        "method":           "",     // "GET" or "POST"
        "url":              "",
        "async":            true,
        "auth":             "",     // "" or "user:password"
        "requestHeader":    {},     // { header: value, ... }
        // --- response ---
        "response":         null,
        "responseText":     "",
        "responseXML":      null,
        "responseHeaders":  {},     // { header: value, ... }
        "status":           0,
        "statusText":       "",
        "upload":           null,
        "withCredentials":  false
    };
    this._lastRequestURL = "";
    this._lastReadyState = READY_STATE_UNSENT;

    // setup property getter and setter.
    Object.defineProperties(this, {
        "readyState":     { "get": getReadyState                                },
        "response":       { "get": getResponse                                  },
        "responseText":   { "get": getResponseText                              },
        "responseType":   { "get": getResponseType,   "set": setResponseType    },
        "responseXML":    { "get": getResponseXML                               },
        "status":         { "get": getStatus                                    },
        "statusText":     { "get": getStatusText                                },
        "upload":         { "get": getUpload,         "set": setUpload          },
        "withCredentials":{ "get": getWithCredentials,"set": setWithCredentials }
    });
}

//{@dev
WMXMLHttpRequest["repository"] = "https://github.com/uupaa/WMXMLHttpRequest.js";
//}@dev

WMXMLHttpRequest["get"] = WMXMLHttpRequest_get;                    // WMXMLHttpRequest.get(url:URLString, callback:Function):void
WMXMLHttpRequest["prototype"] = {
    "constructor":          WMXMLHttpRequest,
    "abort":                WMXMLHttpRequest_abort,                // WMXMLHttpRequest#abort():void
    "getAllResponseHeaders":WMXMLHttpRequest_getAllResponseHeaders,// WMXMLHttpRequest#getAllResponseHeaders():String
    "getResponseHeader":    WMXMLHttpRequest_getResponseHeader,    // WMXMLHttpRequest#getResponseHeader(name:String):String
    "open":                 WMXMLHttpRequest_open,                 // WMXMLHttpRequest#open(method:String, url:URLString, async:Boolean = true,
                                                                   //                user:String = "", password:String = ""):void
    "overrideMimeType":     WMXMLHttpRequest_overrideMimeType,     // WMXMLHttpRequest#overrideMimeType():void
    "send":                 WMXMLHttpRequest_send,                 // WMXMLHttpRequest#send(data:Any = null):void
    "setRequestHeader":     WMXMLHttpRequest_setRequestHeader,     // WMXMLHttpRequest#setRequestHeader():void
    "addEventListener":     WMXMLHttpRequest_on,                   // WMXMLHttpRequest#addEventListener(type:EventTypeString, callback:Function):this
    "removeEventListener":  WMXMLHttpRequest_off,                  // WMXMLHttpRequest#removeEventListener(type:EventTypeString, callback:Function):this
    "on":                   WMXMLHttpRequest_on,                   // WMXMLHttpRequest#on(type:EventTypeString, callback:Function):Boolean
    "off":                  WMXMLHttpRequest_off,                  // WMXMLHttpRequest#off(type:EventTypeString, callback:Function):Boolean
    "clear":                WMXMLHttpRequest_clear,                // WMXMLHttpRequest#clear():this
//  "level":                function() { return 1; },              // WMXMLHttpRequest#level():Number
//  "convert":              WMXMLHttpRequest_convert,              // WMXMLHttpRequest#convert():Any
    // --- internal ---
    "handleEvent":          WMXMLHttpRequest_handleEvent
};

// --- implements ------------------------------------------
function getReadyState()        { return this._xhr["readyState"]; }
function getResponse()          { return this._xhr["response"]; }
function getResponseText()      { return this._xhr["responseText"]; }
function getResponseType()      { return this._xhr["responseType"]; }
function setResponseType(v)     {        this._xhr["responseType"] = v; }
function getResponseXML()       { return this._xhr["responseXML"]; }
function getStatus()            { return this._xhr["status"]; }
function getStatusText()        { return this._xhr["statusText"]; }
function getUpload()            { return this._xhr["upload"] || null; }
function setUpload(v)           {        this._xhr["upload"] = v; }
function getWithCredentials()   { return this._xhr["withCredentials"] || false; }
function setWithCredentials(v)  {        this._xhr["withCredentials"] = v;  }
function WMXMLHttpRequest_abort() { this._xhr["abort"](); }

function WMXMLHttpRequest_get(url,      // @arg URLString
                              callback, // @arg Function - callback.call(xhr, error, response):void
                              type) {   // @arg String = "text" - responseType: "arraybuffer", "blob", "document", "text", "json"
                                        // @desc convenient function.
//{@dev
    $valid($type(url,      "URLString"), WMXMLHttpRequest_get, "url");
    $valid($type(callback, "Function"),  WMXMLHttpRequest_get, "callback");
    $valid($type(type,     "String|omit"), WMXMLHttpRequest_get, "type");
    $valid($some(type,     "arraybuffer|blob|document|text|json"), WMXMLHttpRequest_get, "type");
//}@dev

    //
    // XHRProxy.get is convenient "GET" function.
    //
    //  1:  XHRProxy.get(url, function(error, response) {
    //  2:      console.log(response);
    //  3:  });
    //
    // without XHRProxy.get function (not recommended).
    //
    //  1:  var xhr = new XHRProxy();
    //  2:  xhr.on("load", function(event) {
    //  3:      console.log(xhr.responseText);
    //  4:  });
    //  5:  xhr.open("GET", url);
    //  6:  xhr.send();
    //

    type = type || "text";
    var xhr = new WMXMLHttpRequest();

    xhr["on"]("load", function() {
        var xhr = this;

        if ( _isSuccess(xhr["status"]) ) {
            callback.call(xhr, null, xhr["response"] || xhr["responseText"]);
        } else {
            callback.call(xhr, new Error(xhr["status"]), "");
        }
    });
    if (type && type !== "text") {
        xhr["responseType"] = type;
    }
    xhr["open"]("GET", url);
    xhr["send"]();
}

function WMXMLHttpRequest_getAllResponseHeaders() { // @ret String
    var headers = this._xhr["responseHeaders"];

    return Object.keys(headers).map(function(key) {
                return key + ":" + headers[key];
            }).join("\n");
}

function WMXMLHttpRequest_getResponseHeader(name) { // @arg String
                                                    // @ret String
//{@dev
    $valid($type(name, "String"), WMXMLHttpRequest_getResponseHeader, "name");
//}@dev

    return this._xhr["responseHeaders"][name];
}

function WMXMLHttpRequest_open(method,     // @arg String - "GET" or "POST"
                               url,        // @arg URLString
                               async,      // @arg Boolean = true
                               user,       // @arg String = ""
                               password) { // @arg String = ""
//{@dev
    $valid(this._xhr["readyState"] === READY_STATE_UNSENT,
                                           WMXMLHttpRequest_open, "sequence error");
    $valid($type(method, "String"),        WMXMLHttpRequest_open, "method");
    $valid($some(method, "GET|POST"),      WMXMLHttpRequest_open, "method");
    $valid($type(url,    "URLString"),     WMXMLHttpRequest_open, "url");
    $valid($type(async,  "Boolean|omit"),  WMXMLHttpRequest_open, "async");
    $valid($type(user,   "String|omit"),   WMXMLHttpRequest_open, "user");
    $valid($type(password, "String|omit"), WMXMLHttpRequest_open, "password");
//}@dev

    async = async === undefined ? true : async;

    this._lastRequestURL = url;
    this._lastReadyState = READY_STATE_UNSENT;
    this._xhr["method"] = method;
    this._xhr["url"]    = url;
    this._xhr["async"]  = async;
    this._xhr["auth"]   = user && password ? (user + ":" + password) : "";

    if (this._xhr["readyState"] === READY_STATE_UNSENT) {
        this._xhr["readyState"] = READY_STATE_OPENED;
        this._xhr["status"] = 0;
        this._xhr["responseText"] = "";

        _fireEvent(this, "readystatechange");
    }
}

function WMXMLHttpRequest_overrideMimeType(mimeType) { // @arg String
//{@dev
    $valid($type(mimeType, "String"), WMXMLHttpRequest_overrideMimeType, "mimeType");
//}@dev

//  this._xhr["overrideMimeType"](mimeType);
}

function WMXMLHttpRequest_send(data) { // @arg Any = null - POST request body
//{@dev
    $valid(this._xhr["readyState"] === READY_STATE_OPENED,
                                          WMXMLHttpRequest_send, "sequence error");
    $valid($type(data, "null|undefined"), WMXMLHttpRequest_send, "data");
//}@dev

    var url = WMURL["parse"](this._xhr["url"]);
    var username = url["username"] || "";
    var password = url["password"] || "";
    var auth = (username && password) ? (username + ":" + password) : "";
    var options = {
            host:   url["hostname"],   // without port number, "example.com:80" -> Error
            port:   url["port"] || 80,
            path:   url["path"],
            auth:   this._xhr["auth"] || auth || "",
            mehtod: this._xhr["method"],
            headers:this._xhr["requestHeader"]
        };

    if (url["host"]) {
        _getRemoteFile(this, options);
    } else {
        _getLocalFile(this, url["pathname"]);
    }
}

function _getRemoteFile(that, options) {
    http["get"](options, function(response) {
        response["setEncoding"]("utf8");

        that.handleEvent();

        // sequence --------------------------------------
        that._xhr["readyState"] = READY_STATE_HEADERS_RECEIVED;
        that._xhr["responseHeaders"] = response["headers"];
        that._xhr["status"] = response["statusCode"];
        that.handleEvent();

        // sequence --------------------------------------
        that._xhr["readyState"] = READY_STATE_LOADING;
        that.handleEvent();

        response["on"]("data", function(chunk) {
            that._xhr["responseText"] += chunk;
            that.handleEvent();
        });
        // sequence --------------------------------------
        response["on"]("end", function() {
            that._xhr["readyState"] = READY_STATE_DONE;

            that.handleEvent();
        });
    })["on"]("error", function(error) {
        that._xhr["readyState"] = READY_STATE_DONE;
        that._xhr["statusText"] = error["message"];
        that._xhr["status"] = 400;

        that.handleEvent();
        _fireEvent(that, "error");
    });
}

function _getLocalFile(that, file) {
    if ( !fs["existsSync"](file) ) {
        _error(404);
    } else {
        fs["readFile"](file, { "encoding": "utf8" }, function(err, data) {
            if (err) {
                _error(400);
            } else {
                that.handleEvent();

                // sequence --------------------------------------
                that._xhr["readyState"] = READY_STATE_HEADERS_RECEIVED;
                that._xhr["responseHeaders"] = {};
                that._xhr["status"] = 200;
                that.handleEvent();

                // sequence --------------------------------------
                that._xhr["readyState"] = READY_STATE_LOADING;
                that.handleEvent();

                that._xhr["responseText"] = data;

                // sequence --------------------------------------
                that._xhr["readyState"] = READY_STATE_DONE;

                that.handleEvent();
            }
        });
    }

    function _error(status) {
        that._xhr["readyState"] = READY_STATE_DONE;
        that._xhr["status"] = status || 400;

        that.handleEvent();
        _fireEvent(that, "error");
    }
}

function WMXMLHttpRequest_setRequestHeader(name,    // @arg String - header name
                                           value) { // @arg String - header value
//{@dev
    $valid($type(name,  "String"), WMXMLHttpRequest_setRequestHeader, "name");
    $valid($type(value, "String"), WMXMLHttpRequest_setRequestHeader, "value");
//}@dev

    this._xhr["requestHeader"][ name.toLowerCase() ] = value;
}

function WMXMLHttpRequest_on(type,       // @arg EventTypeString - "readystatechange"
                             callback) { // @arg Function
                                         // @ret this
    this._event["on"](null, type, callback);
    return this;
}

function WMXMLHttpRequest_off(type,       // @arg EventTypeString - "readystatechange"
                              callback) { // @arg Function
                                          // @ret this
    this._event["off"](null, type, callback);
    return this;
}

function WMXMLHttpRequest_clear() { // @ret this
    this._event["clear"](null);
    return this;
}

function WMXMLHttpRequest_handleEvent(event) { // @arg EventObject|null
                                               // @desc simulate XHR Lv2 events
    var xhr = this._xhr;
    var status = xhr["status"];
    var readyState = xhr["readyState"];

    if (this._lastReadyState !== readyState) {
        this._lastReadyState = readyState;
        _fireEvent(this, "readystatechange", event);
    }

    switch (readyState) {
    case READY_STATE_OPENED:
        _fireEvent(this, "loadstart", event);
        break;
    case READY_STATE_HEADERS_RECEIVED:
        _fireEvent(this, "progress", event);
        break;
    case READY_STATE_LOADING:
        _fireEvent(this, "progress", event);
        break;
    case READY_STATE_DONE:
        if ( _isSuccess(status, /^file\:/.test(this._lastRequestURL)) ) {
            try {
                xhr["response"] = _convertDataType(xhr["responseText"],
                                                   xhr["responseType"]);
            } catch (o_O) {
            }
            _fireEvent(this, "load", event);
        }
        _fireEvent(this, "loadend", event);
    }
}

function _fireEvent(that,    // @arg this
                    type,    // @arg EventTypeString - "readystatechange", "loadstart", "progress", "load", "error", "loadend"
                    event) { // @arg EventObject = null - { type, ... }
    event = event || { type: type };

    if ( that._event["has"](type) ) {
        that._event["list"](type).forEach(function(callback) {
            callback.call(that._xhr, event);
        });
    }
}
function _convertDataType(text, type) {
    switch (type) {
    case "json":    return JSON.parse(text);                      // -> Object
    case "document":return _createHTMLDocument(text);             // -> Document|String
    case "arraybuffer":
    case "blob":    return DataType["Array"]["fromString"](text); // -> ByteArray
    }
    return text;
}

function _createHTMLDocument(text) {
    if (_runOnBrowser) {
        var body = document.createElement("body");

        body["innerHTML"] = text;
        return body;
    }
    return text;
}

function _isSuccess(status,         // @arg Integer - HTTP_STATUS_CODE
                    isFileScheme) { // @arg Boolean = false
                                    // @ret Boolean
    var ok = status >= 200 && status < 300;

    return isFileScheme ? (status === 0 || ok)
                        : ok;
}

// --- validate / assertions -------------------------------
//{@dev
function $valid(val, fn, hint) { if (global["Valid"]) { global["Valid"](val, fn, hint); } }
function $type(obj, type) { return global["Valid"] ? global["Valid"].type(obj, type) : true; }
//function $keys(obj, str) { return global["Valid"] ? global["Valid"].keys(obj, str) : true; }
function $some(val, str, ignore) { return global["Valid"] ? global["Valid"].some(val, str, ignore) : true; }
//function $args(fn, args) { if (global["Valid"]) { global["Valid"].args(fn, args); } }
//}@dev

// --- exports ---------------------------------------------
if ("process" in global) {
    module["exports"] = WMXMLHttpRequest;
}
global["WMXMLHttpRequest" in global ? "WMXMLHttpRequest_"
                                    : "WMXMLHttpRequest"] = WMXMLHttpRequest; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule


