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
        testWMCache_limit,
        testWMCache_tearDown,
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
    var limit = 5 * 1024 * 1024;

    new WMCache({ limit: limit }, function(cache) { // export global.cache
        global.cache = cache;

        cache.clear(function() {
            test.done(pass());
        });
    }, cacheError);
}

function testWMCache_limit(test, pass, miss) {
    var cache = global.cache;
    var urls = [
            ASSETS_DIR + "pen.mp4",             // 2.5MB
            ASSETS_DIR + "Parasail.m4a",        // 1.5MB
            ASSETS_DIR + "Rain-Heavy-Loud.m4a", // 4MB   -> limit over
        ];
    var total = 0;

    Task.loop(urls, tick, function(err, buffer) {
        debugger;
        var list = cache.list();
        var size = cache.size();

        // 4MB のファイル(Rain-Heavy-Loud.m4a)は
        // キャッシュlimit(5MB)に引っかかりキャッシュ対象外となる
        if (Object.keys(list).length === 2) {
            if (total > size) {
                test.done(pass());
                return;
            }
        }
        test.done(miss());
    });

    function tick(task, index, urls) {
        cache.get(urls[index], function(url, data, mime, size, cached) {
            total += size;
            task.pass();
        }, { wait: true })
    }
}

function testWMCache_tearDown(test, pass, miss) {
    global.cache.clean();
    test.done(pass());
}

})((this || 0).self || global);

