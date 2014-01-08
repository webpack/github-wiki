var http = require("http");
var https = require("https");
var LRU = require("lru-cache");

var port = process.env.PORT || 3000;

var cache = LRU({
	max: 1024 * 1024 * 5, // 10MB
	length: function(n) { return typeof n === "number" ? 4 : n.length },
	maxAge: 1000 * 60 * 5 // 5m
});

http.createServer(function (req, res) {
	var path = req.url;
	if(path.indexOf("..") >= 0) return res.end("");
	var cacheEntry = cache.get(path);
	res.statusCode = 200;
	res.setHeader("Content-Type", "text/plain");
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET");
	res.setHeader("Access-Control-Max-Age", "86400");
	res.setHeader("Cache-Control", "max-age=300, public");
	if(cacheEntry) {
		res.setHeader("X-Was-Cached", "Yes");
		if(typeof cacheEntry === "number") {
			res.statusCode = cacheEntry;
			res.end(cacheEntry + " Cached");
		} else {
			res.end(cacheEntry);
		}
		return;
	}
	console.log("Downloading request to " + path);
	https.get("https://raw.github.com/wiki" + path + ".md", function(rawRes) {
		if(rawRes.statusCode === 200) {
			var result = [];
			rawRes.on("data", function(d) { result.push(d); });
			rawRes.on("end", function() {
				result = Buffer.concat(result);
				cache.set(path, result);
			});
			rawRes.pipe(res);
		} else {
			res.statusCode = rawRes.statusCode;
			cache.set(path, rawRes.statusCode);
			rawRes.pipe(res);
		}
	}).on("error", function(err) {
		try {
			res.statusCode = 500;
			cache.set(path, 500);
			res.end();
		} catch(e) {
			console.error(e);
		}
	});
}).listen(port, function() {
	console.log('Server running at ' + port);
});
