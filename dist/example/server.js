const http = require('http');
const fs = require('fs');
const path = require('path');
const mime = require('mime');//根据文件后缀获取文件类型工具

const server = http.createServer((req, res) => {
    console.log(req.url);
	var realPath;
	if(req.url.indexOf('?')>-1){
		realPath = __dirname+req.url.substring(0,req.url.indexOf('?'));
	}else{
		realPath = __dirname+req.url;
	}
	
    var exist = fs.existsSync(realPath);
    if(exist){
        sendFile(realPath,req,res);
    }else{
        res.writeHead(404,'file not exist');
        res.end();
    }
    
});

server.listen(8000);

function sendFile(realPath,req,res){
    var stat = fs.statSync(realPath);
    //判断是请求头中是否有range部分
    if (req.headers.range) {
        var size = stat.size; //获取文件大小
        //暂且写在这里
        function getRange() {
            var range = req.headers.range;
            if (range.indexOf(",") != -1) { //这里只处理了一个分段的情况
                return false;
            }
            //range：bytes=0-255[,256-511]
            var parts = range.replace(/bytes=/, '').split("-");
            var partiaStart = parts[0];
            var partialEnd = parts[1];
            var start = parseInt(partiaStart); //起始位置
            //如果是bytes=0-，就是整个文件大小
            var end = partialEnd ? parseInt(partialEnd) : size - 1;
            if (isNaN(start) || isNaN(end)) return false;
            //分段的大小
            var chunkSize = end - start + 1;
            return { 'start': start, 'end': end, 'chunkSize': chunkSize };
        }
        var rangeData = getRange();
        if (rangeData) {
            //createReadStream原生支持range
            var raw = fs.createReadStream(realPath, { 'start': rangeData.start, 'end': rangeData.end });
            //状态码206
            res.writeHead(206, 'Partial Content', {
                'Content-Type': mime.getType(path.basename(realPath)),
                'Content-Range': 'bytes ' + rangeData.start + '-' + rangeData.end + '/' + size,
                'Content-Length': rangeData.chunkSize,
                'Access-Control-Allow-Origin': '*',
                "Access-Control-Allow-Headers": "Content-Range,Range",
                "Access-Control-Expose-Headers": "Content-Range,Range"
            });
            raw.on('data',function(chunk){
            	// 加密数据
            	// for(let i=0; i<chunk.length; i++){
            	// 	chunk[i] = chunk[i]^255;
            	// }
            	res.write(chunk);
            });
            raw.on('end', function(){
			  console.log('read end');
			  res.end();
			});
            // raw.pipe(res);
        } else {
            res.writeHead(416, "not ok!");
            res.end();
        }
        console.log('send media file:'+realPath);
    } else {
        res.writeHead(200, {
            'Content-Type': mime.getType(path.basename(realPath)),
            'Access-Control-Allow-Origin': '*',
            "Access-Control-Allow-Headers": "Content-Range,Range"
        });
        if(req.method == 'get' || req.method == 'post'){
            var file = fs.readFileSync(realPath);
            res.end(file);
            console.log('send static file:'+realPath);
        }else{
            res.end();
        }
    }
}
console.log('listen 8000')