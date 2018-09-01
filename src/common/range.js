/**
 * 分段下载
 * @param  {int}  begin  字节开始位置
 * @param  {int}  end  字节结束位置(包括)
 * @param  {Functio}  callback  成功回调
 */
function _loadRange(url, begin, end, opt) {
    var request = new XMLHttpRequest();
    var emptyCb = function() {};
    var onsuccess, onerror, onabort, ontimeout;
    onsuccess = onerror = onabort = ontimeout = emptyCb;
    begin = begin || 0;
    end = end || '';
    if (typeof opt == 'object') {
        opt.onsuccess && (onsuccess = opt.onsuccess);
        opt.onerror && (onerror = opt.onerror);
        opt.onabort && (onabort = opt.onabort);
        opt.ontimeout && (ontimeout = opt.ontimeout);
    }
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = function() {
        var arrayBuffer = request.response;
        var contetnRange = request.getResponseHeader('Content-Range');

        if (contetnRange && contetnRange.split('/')[0].substr(6) != begin + '-' + end) {
            console.log(contetnRange.split('/')[0].substr(6), begin + '-' + end)
            console.error('获取头部信息出错');
            onerror('获取头部信息出错');
        } else {
            onsuccess(request);
        }
    }
    request.onerror = onerror;
    request.onabort = onabort;
    request.ontimeout = ontimeout;

    request.setRequestHeader("Range", 'bytes=' + begin + '-' + end);
    request.send();
    return request;
}

export default _loadRange;