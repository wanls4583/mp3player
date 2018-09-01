import AudioContextPlayer from './src/audiocontext/player';
import MediaSourcetPlayer from './src/mediasource/player';

function Player(url, opt){
	if(opt.usemediasource){
		return new MediaSourcetPlayer(url, opt);
	}else{
		return new AudioContextPlayer(url, opt);
	}
}

window.Player = Player;

export default Player;