var ModuleTestWMCache = (function(global) {

var URL = global["URL"] || global["webkitURL"];

var _runOnNode = "process" in global;
var _runOnWorker = "WorkerLocation" in global;
var _runOnBrowser = "document" in global;


global.cache = null;

var test = new Test("WMCache", {
        disable:    false,
        browser:    true,
        worker:     false,
        node:       false,
        button:     false,
        both:       false, // test the primary module and secondary module
    }).add([
        testWMCache_setup,
        testWMCache_getWebFont,
        testWMCache_reget,
        testWMCache_storeDotfile,
        testWMCache_getAndStore,
        testWMCache_get,
        testWMCache_size,
        testWMCache_getArrayBuffer,
        testWMCache_gcButSurviveDotFiles,
        testWMCache_clear,
    ]);

test.run().clone();

var ASSETS_DIR = "../node_modules/uupaa.wmcachetest.js/assets/";

function cacheError(err) {
    if (err instanceof ProgressEvent) {
        console.error( err.target.error.message );
    } else {
        console.error( err.message );
    }
}

function testWMCache_gcButSurviveDotFiles(test, pass, miss) {
    var cache = global.cache;

    cache.gc();

    var times = 5;

    function _watch() {
        console.log("..wait");
        var list = cache.list();
        var ok = true;

        for (var url in list) {
            console.log(url);
            if (url[0] !== ".") {
                ok = false;
                break;
            }
        }
        if (ok) {
console.log("pass");
            test.done(pass());
        } else {
            if (--times <= 0) {
console.log("miss");
                test.done(miss());
            } else {
                setTimeout(_watch, 1000);
            }
        }
    }
    setTimeout(_watch, 1000);
}

function testWMCache_size(test, pass, miss) {
    var cache = global.cache;

    if (cache.size() >= 0) {
        test.done(pass());
    } else {
        test.done(miss());
    }
}

function testWMCache_clear(test, pass, miss) {
    var cache = global.cache;

    cache.clear(function() {
        if (Object.keys(cache.list()).length === 0) {
            test.done(pass());
        } else {
            test.done(miss());
        }
    });
}

function testWMCache_setup(test, pass, miss) {
    new WMCache({}, function(cache) { // export global.cache
        global.cache = cache;
        test.done(pass());
    }, cacheError);
    document.body.innerHTML += '<p><input type="button" value="cache.clear()" onclick="cache.clear()"></input></p>';
}

function _multiline(fn) { // @arg Function:
                          // @ret String:
    return (fn + "").split("\n").slice(1, -1).join("\n");
}

function testWMCache_getWebFont(test, pass, miss) {
    var cache = global.cache;
    var url = ASSETS_DIR + "NotoSansCJKjp-Regular.otf";

    cache.getBlobURL(url, function(url, blobURL, mime, size, cached) {
        addTextUsingWebFont();
        addStyleNode(blobURL);

        var message = document.querySelector(".message");
        var computedStyle = global.getComputedStyle(message);

        if (computedStyle.fontFamily === "Noto") {
            test.done(pass());
        } else {
            test.done(miss());
        }
    });
}

function addStyleNode(blobURL) {
    var css = _multiline(function() {/*

@font-face {
    font-family: "Noto";
    src: url("BLOB_URL");
}
p.message {
    font-family: "Noto";
}

*/}).replace(/BLOB_URL/g, blobURL);

    var style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.innerHTML = css;
    document.head.appendChild(style);
}

function addTextUsingWebFont() {
    document.body.innerHTML += _multiline(function() {/*
<p class="message">
こんにちは日本におけるWebFontの世界。<br />
私は今、WMCache.js でローカルにキャッシュされた<br />16.4MBのWebFont(Noto)を使い、貴方の心に直接語りかけています。
</p>
*/});
}


function testWMCache_reget(test, pass, miss) {
    var cache = global.cache;
    var url = ASSETS_DIR + "1.png";

    // [1] drop a cache
    // [2] reget
    // [3] check cache
    // [4] fetch cache

    cache.drop(url, function() { // [1]
        cache.get(url, function(url, data, mime, size, cached) { // [2]
            if (cached === true) {
                test.done(miss());
            } else {
                if (!cache.has(url)) { // [3]
                    test.done(miss());
                } else {
                    cache.get(url, function(url, data, mime, size, cached) { // [4]
                        if (cached === true) {
                            test.done(pass());
                        } else {
                            test.done(miss());
                        }
                    });
                }
            }
        }, { reget: true, wait: true });
    });
}

function testWMCache_storeDotfile(test, pass, miss) {
    var cache = global.cache;
    var dataSource = [0,1,2,3,4,5,6,7];
    var data = new Uint8Array(dataSource);

    cache.store(".dotfile", data.buffer, "", data.buffer.byteLength, function() {
        cache.getArrayBuffer(".dotfile", function(url, data, mime, size, cached) {
            var buffer = new Uint8Array(data);

            if (cached && dataSource.length === size) {
                if ([].slice.call(buffer).join() === dataSource.join()) {
                    test.done(pass());
                    cache.drop(".dotfile");
                    return;
                }
            }
            test.done(miss());
        });
    });
}

function testWMCache_get(test, pass, miss) {
    var images = [
            ASSETS_DIR + "1.png",
            ASSETS_DIR + "2.png",
            ASSETS_DIR + "3.png",
            ASSETS_DIR + "4.png",
            ASSETS_DIR + "5.png",
            ASSETS_DIR + "6.png",
            ASSETS_DIR + "7.png",
            ASSETS_DIR + "8.png",
        ];

    var task = new TestTask(images.length + 1, function(err, buffer) {
            if (err) {
                test.done(miss());
            } else {
                setTimeout(function() {
                    test.done(pass());
                }, 2000);
            }
        });

    var imageNodes = [];

    images.forEach(function(url) {
        cache.getBlobURL(url, function(url, blobURL, mime, size) {
            var img = new Image();
            img.src = blobURL;
            imageNodes.push( document.body.appendChild(img) );
            task.pass();
        }, { wait: true });
    });

    // tear down
    setTimeout(function() {
        imageNodes.forEach(function(node) {
            document.body.removeChild(node);
        });
        task.pass();
    }, 2000);
}

function testWMCache_getAndStore(test, pass, miss) {
    var images = [
            ASSETS_DIR + "1.png",
            ASSETS_DIR + "2.png",
            ASSETS_DIR + "3.png",
            ASSETS_DIR + "4.png",
            ASSETS_DIR + "5.png",
            ASSETS_DIR + "6.png",
            ASSETS_DIR + "7.png",
            ASSETS_DIR + "8.png",
        ];

    var task = new TestTask(images.length + 1, function(err, buffer) {
            if (err) {
                test.done(miss());
            } else {
                setTimeout(function() {
                    test.done(pass());
                }, 2000);
            }
        });

    var imageNodes = [];

    images.forEach(function(url) {
        cache.getBlob(url, function(url, blob, mime, size) {
            var dotfile = "." + WMURL.parse(url).file;

            cache.store(dotfile, blob, mime, size, function(url, code, stored) {
                cache.getBlobURL(url, function(url, blobURL, mime, size) {
                    var img = new Image();
                    img.src = blobURL;
                    imageNodes.push( document.body.appendChild(img) );
                    if (url[0] === ".") {
                        task.pass();
                    } else {
                        task.miss();
                    }
                });
            });
        }, { wait: true });
    });

    // tear down
    setTimeout(function() {
        imageNodes.forEach(function(node) {
            document.body.removeChild(node);
        });
        task.pass();
    }, 2000);
}

function testWMCache_getArrayBuffer(test, pass, miss) {
    var task = new TestTask(4, function(err, buffer) {

            var node = document.querySelector("#a");
            node.parentNode.removeChild(node);

            if (err) {
                test.done(miss());
            } else {
                test.done(pass());
            }
        });

    setup();

    function setup() {
        global.addStock(0, "webaudio", ASSETS_DIR + "game.m4a",            "arraybuffer");
        global.addStock(1, "webaudio", ASSETS_DIR + "Parasail.m4a",        "arraybuffer");
        global.addStock(2, "webaudio", ASSETS_DIR + "Rain-Heavy-Loud.m4a", "arraybuffer");
        global.addStock(3, "webaudio", ASSETS_DIR + "pen.mp4",             "arraybuffer");

        document.body.innerHTML +=
            '<div id="a">' +
                '<p>Audio Test</p>' +
                '<br />572KB Audio<br />' +
                '<input type="button" value="getCachedAudio(0)" onclick="getCachedAudio(0)"></input>' +
                '<input type="button" value="playAudio(0)" onclick="playAudio(0)"></input>' +
                '<input type="button" value="stopAudio(0)" onclick="stopAudio(0)"></input>' +
                '<input type="button" value="test.done(0)" onclick="tearDown();hide(this)"></input>' +
                '<br ><br >1.5MB Audio<br />' +
                '<input type="button" value="getCachedAudio(1)" onclick="getCachedAudio(1)"></input>' +
                '<input type="button" value="playAudio(1)" onclick="playAudio(1)"></input>' +
                '<input type="button" value="stopAudio(1)" onclick="stopAudio(1)"></input>' +
                '<input type="button" value="test.done(1)" onclick="tearDown();hide(this)"></input>' +
                '<br ><br >4MB Audio<br />' +
                '<input type="button" value="getCachedAudio(2)" onclick="getCachedAudio(2)"></input>' +
                '<input type="button" value="playAudio(2)" onclick="playAudio(2)"></input>' +
                '<input type="button" value="stopAudio(2)" onclick="stopAudio(2)"></input>' +
                '<input type="button" value="test.done(2)" onclick="tearDown();hide(this)"></input>' +
                '<br ><br >2.5MB Movie<br />(Chrome for Android maybe crash)<br />' +
                '<input type="button" value="getCachedAudio(3)" onclick="getCachedAudio(3)"></input>' +
                '<input type="button" value="playAudio(3)" onclick="playAudio(3)"></input>' +
                '<input type="button" value="stopAudio(3)" onclick="stopAudio(3)"></input>' +
                '<input type="button" value="test.done(3)" onclick="tearDown();hide(this)"></input>' +
            '</div>';
    }

    global.getCachedAudio = function getCacheAudio(n) {
        var target = global.stock[n];
        var url = target.url;

        cache.getArrayBuffer(url, function(url, data, mime, size, cached) {
            target.data = data; // blob or arraybuffer
            target.mime = mime;
            target.size = size;
            global.downloaded(n);
        });
    };

    global.tearDown = function() {
        task.pass();
    };
    global.hide = function(node) {
        node.style.cssText = "visibility: hidden";
    };
}

global.downloaded = downloaded;
function downloaded(n) {
    var target = global.stock[n];
    var data = target.data;

    if (target.nodeType === "audio") {
        var bloburl = "";
        if (data instanceof ArrayBuffer) {
            bloburl = URL.createObjectURL( new Blob([data], { type: target.mime }) );
        } else if (data instanceof Blob) {
            bloburl = URL.createObjectURL(data);
        } else {
            bloburl = target.url;
        }
        target.node = new Audio();
        target.node.src = bloburl;
        target.node.volume = 0.2;
        target.node.addEventListener("progress", handleEvent, false);
        target.node.addEventListener("canplay", handleEvent, false);
        target.node.load();
    } else {
        if (data instanceof ArrayBuffer) {
            global.webAudioContext.decodeAudioData(data, function(decodedBuffer) {
                target.sound.buffer = decodedBuffer;
                target.data = null; // [!] gc
                global.changeBodyColor();
            });
        } else if (data instanceof Blob) {
            var reader = new FileReader();
            reader.onloadend = function() {
                target.data = null; // [!] gc
                global.webAudioContext.decodeAudioData(reader.result, function(decodedBuffer) {
                    target.sound.buffer = decodedBuffer;
                    global.changeBodyColor();
                });
            };
            reader.readAsArrayBuffer(data);
        }
    }

    function handleEvent(event) {
        var duration = target.node.duration;

        switch (event.type) {
        case "canplay":
            target.node.removeEventListener("canplay", handleEvent, false);
            target.sound.canplay = true;
            break;
        case "progress":
            break;
        }
        if (duration > 0 && target.sound.canplay) {
            target.node.removeEventListener("progress", handleEvent, false);
            global.changeBodyColor();
        }
    }
}

})((this || 0).self || global);

