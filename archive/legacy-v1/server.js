var http = require("http"),
	url = require("url"),
	path = require("path"),
	fs = require("fs")
	port = process.argv[3] || 8000;


http.createServer(function(request, response){
	
	 var uri = url.parse(request.url).pathname,
	 	filename = path.join(process.cwd(), uri);

	path.exists(filename, function(exists){
		if(!exists){
			response.writeHead(404, {"Content-Type": "text/plan"});
			response.write("404 Not Found\n");
			//response.end('_testcb(\'{"message": "Hello world!"}\')');
			response.end();
			return;
		}

		if(fs.statSync(filename).isDirectory())	{ 
			filename +='/index.html';
		}

		fs.readFile(filename, "binary", function(err, file){
			if(err){
				response.writeHead(500, {"Content-Type": "text/plain"});
				response.write(err + "\n");
				//response.end('_testcb(\'{"message": "Hello world!"}\')');
				response.end();
				return;
			}

			response.writeHead(200);
			response.write(file, "binary");
			//response.end('_testcb(\'{"message": "Hello world!"}\')');
			response.end();
		});
	});

	//Code to print out the contents of the files into the buffered stream of n
	// var fileName = "json.txt";
	// fs.exists(fileName, function(exists) {
 //  		if (exists) {
 //    		fs.stat(fileName, function(error, stats) {
 //      			fs.open(fileName, "r", function(error, fd) {
 //        			var buffer = new Buffer(stats.size);
 //       				 fs.read(fd, buffer, 0, buffer.length, null, function(error, bytesRead, buffer) {
 //          				var data = buffer.toString("utf8", 0, buffer.length);
 //         				console.log(data);
 //          				fs.close(fd);
 //        			 });
 //      			});
 //    		});
 //  		}
	// });

// Code to test in displaying the resource file onto the browser
// fs.exists(filename, function(exists) {
  //  		if (exists) {
  //   		fs.readFile(filename, function(err, data){
  //   			if(err) throw err;	
  //   			response.writeHead(200, {'Content-Type': 'text/plain'});
  //   			response.write(data);
  //   			response.end('_testcb(\'{"message": "Hello world!"}\')');
  //   		});
  //  		}
	 // });


}).listen(parseInt(port, 10));

console.log("Static file server running at\n => http://localhost:" + port + "/\nCTRL + C to shutdown");