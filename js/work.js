onmessage = function(data){
	for(var i=0; i<data.buffer.numberOfChannels; i++){
	    data.dest.getChannelData(i).set(data.buffer.getChannelData(i).slice(data..offset), 0);
	}
}