var ModuleTestWMCacheQuota = (function(global) {

var Task = global["Task"];
var URL = global["URL"] || global["webkitURL"];

var _runOnNode = "process" in global;
var _runOnWorker = "WorkerLocation" in global;
var _runOnBrowser = "document" in global;
var start = 0, end = 0;


global.cache = null;

var test = new Test("WMCacheQuota", {
        disable:    false,
        browser:    true,
        worker:     false,
        node:       false,
        button:     true,
        both:       false, // test the primary module and secondary module
    }).add([
        testWMCache_setup,
        testWMCache_quota,
    ]);

test.run().clone();

var ASSETS_DIR = "../node_modules/uupaa.wmcachetest.js/assets/";
var unit8Array = new Uint8Array(1024 * 1024 * 5); // 5MB

function cacheError(err) {
debugger;
    if (err instanceof ProgressEvent && err.target.error) {
        console.error( err.target.error.name || err.target.error.message );
    } else if (err) {
        console.error( err.name || err.message );
    } else {
        console.error("UnknownError");
    }
}

function testWMCache_setup(test, pass, miss) {
    new WMCache({}, function(cache) { // export global.cache
        global.cache = cache;
        test.done(pass());
    }, cacheError);
    document.body.innerHTML += '<p><input type="button" value="cache.clear()" onclick="cache.clear()"></input></p>';
}

function testWMCache_quota(test, pass, miss) {
    add(200);

    setTimeout(_tick, 100);
}

global.add = add;
function add(times) {
    end = start + times;

    setTimeout(_tick, 100);
}

function _tick() {
    if (++start < end) {
      // Chrome では書き込みが早過ぎると、
      // 50個Queueにたまった段階で書き込みが連続で失敗するようになる
      //setTimeout(_tick, 100)
      //
      // File I/O よりも FileSystem API の write 要求が多すぎる(早すぎる)と、
      // QuotaExceededError 以外の理由でも失敗する
      // 以下のようにゆっくり目にすることで成功率が上がる
        if (start % 32 === 0) {
            setTimeout(_tick, 2000)
        } else {
            setTimeout(_tick, 200)
        }
    } else {
        console.log("done");
        cache.quota();
        console.dir(cache.list());
    }
    _store("." + start + ".png");
}

function _store(url) {
    var cache = global.cache;

    cache.store(url, unit8Array.buffer, "image/png", unit8Array.buffer.byteLength, function(url, code, stored) {
        switch (code) {
        case 200: console.log(url + " ok");
                  break;
        case 413: console.log(url + " QuotaExceededError");
                  debugger;
                  break;
        case 503: console.log(url + " WriteError");
                  debugger;
                  break;
        }
    });
}

})((this || 0).self || global);

