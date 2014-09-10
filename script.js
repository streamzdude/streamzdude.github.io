var ver = 1;
var startLeft = 50, startTop = 50;

function Stream(stream) {
	$.extend(this, stream);
	this.visible = ko.observable(stream.visible !== false);
	this.window = ko.observable();
}

function Window(stream) {
	var self = this;
	stream.window(this);
	this.stream = stream;
	this.left = ko.observable(startLeft);
	this.top = ko.observable(startTop);
	startLeft = (startLeft + 50) % 400; startTop = (startTop + 50) % 400;
	this.width = ko.observable(stream.width || 600);
	this.height = ko.observable(stream.height || 345);
	this.zIndex = ko.observable(0);	

	this.save = function() {
		return {
			streamName: self.stream.name,
			left: self.left(),
			top: self.top(),
			width: self.width(),
			height: self.height(),
			zIndex: self.zIndex()
		};
	}

	this.load = function(data) {
		self.left(data.left).top(data.top).width(data.width).height(data.height).zIndex(data.zIndex);
	}
}

function StreamzVM(staticStreams) {
	var self = this;
	
	this.windows = ko.observableArray();
	this.streams = ko.observableArray( staticStreams.map(function(stream) { return new Stream(stream) }) );

	this.visibleStreams = ko.computed(function() {
		return self.streams().filter(function(stream) { return stream.visible() });
	});

	this.showOverlay = ko.observable(false);
	this.isCustomizing = ko.observable(false);
	this.showReload = ko.observable(true);

	this.editedStream = {
		origStream: ko.observable(null),
		name: ko.observable(''),
		type: ko.observable('jwplayer'),
		src: ko.observable(''),

		open: function() { $('#editStreamDlg').dialog('open') },
		close: function() { $('#editStreamDlg').dialog('close') },
		ok: function() {
			if (this.origStream()) {

			}
			else {
				var stream = new Stream({
					name: this.name(),
					type: this.type(),
					src: this.src()
				});
				self.streams.splice(0, 0, stream);
			}
			this.close();
		}
	};

	this.bringToFront = function(window) {
		var sortedWindows = self.windows().slice().sort(function(a,b) { return a.zIndex() - b.zIndex() });
		if (~sortedWindows.indexOf(window))
			sortedWindows.splice(sortedWindows.indexOf(window), 1);
		sortedWindows.push(window);
		sortedWindows.forEach(function(win, i) { win.zIndex(10 + i) });
	};

	this.addStream = function() {
		self.editedStream.origStream(null).name('');
		self.editedStream.open();
	}

	this.editStream = function(stream) {
		self.editedStream.origStream(stream).name(stream.name).type(stream.type).src(stream.src);
		self.editedStream.open();
	}

	this.toggleWindow = function(stream) {
		var window = self.windows().filter(function(window) { return window.stream === stream })[0];
		if (window) {
			self.closeWindow(window);
		}
		else {
			window = new Window(stream);
			self.bringToFront(window);
			self.windows.push(window);
			stream.window(window);
			self.save();
		}
	}

	this.closeWindow = function(window) {
		window.stream.window(null);
		self.windows.remove(window);
		self.save();
	}

	this.reloadWindow = function(window) {
		self.windows.remove(window);
		self.windows.push(window);
	}

	this.toggleCustomize = function() {
		self.isCustomizing(!self.isCustomizing());
		if (!self.isCustomizing())
			self.save();
	}

	this.findStream = function(name) {
		return self.streams().filter(function(stream) { return stream.name === name })[0];
	}

	this.moveUp = function(stream) {
		var i = self.streams().indexOf(stream);
		if (i > 0) {
			self.streams.splice(i, 1);
			self.streams.splice(i-1, 0, stream);
		}
	}
	
	this.moveDown = function(stream) {
		var i = self.streams().indexOf(stream);
		if (i < self.streams().length-1) {
			self.streams.splice(i, 1);
			self.streams.splice(i+1, 0, stream);
		}
	}

	this.save = function() {
		var windows = self.windows().map(function(window) { return window.save() });
		var hiddenStreams = self.streams()
				.filter(function(stream) { return !stream.visible() })
				.map(function(stream) { return stream.name });

		var data = {
			ver: ver,
			windows: windows,
			hiddenStreams: hiddenStreams,
			showReload: self.showReload()
		};

		localStorage["streamzData"] = JSON.stringify(data);
	}	

	this.load = function(data)
	{
		self.streams().forEach(function(stream) { 
			stream.window(null);
		});

		if (data.hiddenStreams) {
			data.hiddenStreams.forEach(function(streamName) {
				var stream = self.findStream(streamName)
				if (stream)
					stream.visible(false);
			});
		}

		var windows = data.windows.map(function(windowData) {
			var stream = self.findStream(windowData.streamName);
			if (!stream) return;
			var window = new Window(stream);
			window.load(windowData);
			return window;
		}).filter(function(window) { return !!window });

		self.windows(windows);

		if (typeof data.showReload !== "undefined")
			self.showReload(data.showReload);
	}
}

var numPlayers = 0;
//jwplayer.key='5XXb+w0txH2+cnkwOtAOWXU39zFQbZ6VT9mOA6R83tk=';
jwplayer.key='cH3LS/5ip1cRnTAeAfHTSnww0iWLW/Vb62KpZK+nusI=';

function winJwplayer(elem, stream) 
{
	var player = $('<div>').prop('id', 'player-' + (numPlayers++)).appendTo(elem);

	jwplayer(player[0]).setup({
	    file: stream.src,
	    title: stream.name || 'Untitled',
	    image: stream.image === false ? undefined : 'bomb.png',
	    width: '100%',
	    aspectratio: '16:9',
	    rtmp: {
	    	subscribe: true,
	    	bufferlength: stream.bufferlength || 10
	    }
	});
}

function winIframe(elem, stream) 
{
	$('<iframe webkitallowfullscreen="true" height="100%" width="100%" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" />')
		.prop('src', stream.src)
		.appendTo(elem);
}

ko.bindingHandlers.window = {
	init: function(element, valueAccessor, allBindings, viewModel, bindingContext) 
	{
		var window = ko.unwrap( valueAccessor() );
		var stream = window.stream;
		var elem = $(element);
		var playerDiv = elem.find('.player');		
		var vm = bindingContext.$root;

		elem.css({
			left: window.left() + 'px',
			top: window.top() + 'px',
			width: window.width() + 'px',
			height: window.height() + 'px'
		});

		elem.on('mousedown', function() {
			vm.bringToFront(window);
			vm.save();
		});

		elem.draggable({
			cancel: 'object',
			start: function() {	vm.showOverlay(true) },
			stop: function() { 
				vm.showOverlay(false);
				var pos = elem.position();
				window.left(pos.left).top(pos.top);
				vm.save();
			}
		});

		elem.resizable({
			handles: 'all',
			start: function() {	vm.showOverlay(true) },
			stop: function() { 
				vm.showOverlay(false);
				var pos = elem.position();
				window.left(pos.left).top(pos.top).width(elem.width()).height(elem.height());
				vm.save();
			}			
		});

		switch (stream.type) {
			case 'jwplayer': winJwplayer(playerDiv, stream); break;
			case 'iframe': winIframe(playerDiv, stream); break;
			case 'html': playerDiv.append( stream.src ); break;
		}

		ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
			if (stream.type === 'jwplayer') {
				try { jwplayer(playerDiv.children()[0]).remove(); } catch(e) {}
			}			
			elem.resizable('destroy').draggable('destroy');
		});
	},

	update: function(element, valueAccessor) 
	{
		var window = ko.unwrap( valueAccessor() );
		var elem = $(element);
		elem.css({
			'z-index': window.zIndex()
		});
	}
}


var streams = [
	{
		name: 'Telegraph',
		type: 'iframe',
		src: 'http://player.ooyala.com/iframe.html#ec=42Njdmazp8OPIKJRyChESz2RevNqe2aQ&pbid=ZTIxYmJjZDM2NWYzZDViZGRiOWJjYzc5&docUrl=http://streamzdude.github.io/streamz/'
	},
	{		
		name: 'RT',
		type: 'jwplayer',
		src: 'rtmp://fml.3443.edgecastcdn.net/203443/en-stream',		
		bufferlength: 20
	},
	{
		name: 'Reuters',
		type: 'jwplayer',
		src: 'http://37.58.85.156/rlo001/ngrp:rlo001.stream_all/playlist.m3u8',
		image: false,
		//src: 'http://live.reuters.miisolutions.net/rlo247/ngrp:rlo001.stream_all/24578/playlist.m3u8',
		bufferlength: 20
	},
	{
		name: 'Walla',
		type: 'jwplayer',
		src: 'rtmp://waflalive.walla.co.il/livestreamcast_edge?tuid=23688935517444&un=&ait=129&wkeys=2689&divname=.videochannel&provider=WallaNewsDesk&location=walla.news.&channel_name=news/news',
		bufferlength: 7
	},
	{
		name: 'Ch 2',
		type: 'iframe',
		src: 'http://www.ustream.tv/embed/18458172?v=3&wmode=direct'
	},
	{
		name: 'Ch 10',
//		type: 'iframe',
//		src: 'http://10tv.nana10.co.il/Video/?VideoID=170771&TypeID=0&pid=48&sid=169&ShowBanner=1&VideoPosition=1&CategoryID=600079'
		type: 'html',
		src: '<object class="CTPlayer" type="application/x-shockwave-flash" data="http://hlslive.ch10.cloudvideoplatform.com/CTMLivePlayer.swf?0.9139183044899255" width="100%" height="100%" title="Ch10"><param name="quality" value="high"> <param name="bgcolor" value="#000000"><param name="allowScriptAccess" value="always"> <param name="wmode" value="direct"><param name="allowFullScreen" value="true"><param name="flashvars" value="AutoPlay=true&amp;dfpadunit=CDN_10TV&amp;PathToPlayer=http://hlslive.ch10.cloudvideoplatform.com/"></object>'
	},
	{
		name: 'CNN',
		type: 'html',
		src: '<object type="application/x-shockwave-flash" height="100%" width="100%" data="http://fpdownload.adobe.com/strobe/FlashMediaPlayback_101.swf"><param name="data" value="http://fpdownload.adobe.com/strobe/FlashMediaPlayback_101.swf"><param name="flashvars" value="src=http://wpc.C1A9.edgecastcdn.net/hds-live/20C1A9/cnn/ls_satlink/b_828.f4m&#038;streamType=live&#038;autoPlay=true&#038;controlBarAutoHide=true"><param name="allowFullScreen" value="true"><param name="allowscriptaccess" value="always"><param name="src" value="http://fpdownload.adobe.com/strobe/FlashMediaPlayback_101.swf"><param name="allowfullscreen" value="true"></object>',
//		type: 'jwplayer',
//		src: 'http://rm-edge-1.cdn2.streamago.tv:1935/streamagoedge/34960/28965/playlist.m3u8'
//		type: 'iframe',
//		src: 'http://www.ucaster.eu/embedded/nbvcf5433/1/600/400',
		width: 606,
		height: 418
	},
	{
		name: 'CNN USA',
		type: 'iframe',
		src: 'http://2ndrun.tv/CNN_Test.php?width=600&amp;height=370',
		width: 606,
		height: 378
	},
	/*{
		name: 'CNN USA 2',
		type: 'iframe',
		src: 'http://www.ilive.to/embedplayer.php?width=640&height=480&channel=68419&autoplay=true'
	},*/
	{
		name: 'BBC',
		type: 'jwplayer',
		src: 'http://wpc.c1a9.edgecastcdn.net/hls-live/20C1A9/bbc_world/ls_satlink/b_828.m3u8',
		bufferlength: 6
	},
	{
		name: 'Aljazeera',
		type: 'html',
		src: '<object seamlesstabbing="undefined" class="BrightcoveExperience" id="myExperience1474541474001" data="http://c.brightcove.com/services/viewer/federated_f9?&amp;width=680&amp;height=380&amp;flashID=myExperience1474541474001&amp;bgcolor=%23FFFFFF&amp;playerID=834025853001&amp;playerKey=AQ~~%2CAAAAmtUu4Zk~%2CoARQlkfrZncis5e3VirW1_jMMBOC_SsO&amp;isVid=true&amp;isUI=true&amp;dynamicStreaming=true&amp;%40videoPlayer=1474541474001&amp;autoStart=true&amp;debuggerID=&amp;startTime=1405645205983" type="application/x-shockwave-flash" height="100%" width="100%"><param value="always" name="allowScriptAccess"><param value="true" name="allowFullScreen"><param value="false" name="seamlessTabbing"><param value="true" name="swliveconnect"><param value="window" name="wmode"><param value="high" name="quality"><param value="#000000" name="bgcolor"></object>'
		//src: 'http://admin.brightcove.com/viewer/us20140724.1408/BrightcoveBootloader.swf?playerID=834025853001&autoStart=true&playerKey=AQ~~%2CAAAAmtUu4Zk~%2CoARQlkfrZncis5e3VirW1_jMMBOC_SsO&purl=http%3A%2F%2Fwww.alwatanvoice.com%2Flive%2F&%40videoPlayer=1474541474001&autoStart=false&bgcolor=%23000000&debuggerID=&dynamicStreaming=true&flashID=myExperience1474541474001&height=380&isUI=true&isVid=true&startTime=1405645205983&width=680'
	},
	{
		name: 'Al Aqsa',
		type: 'jwplayer',
		src: 'http://live.aqsatv.atyaf.co:1935/aqsatv/live/tv/playlist.m3u8',
		bufferlength: 60,
		visible: false
//		type: 'html',
//		src: '<object width="100%" height="100%" id="player_api" name="player_api" data="http://aqsatv.ps/live/swf/flowplayer-3.2.18.swf" type="application/x-shockwave-flash"><param name="allowfullscreen" value="true"><param name="allowscriptaccess" value="always"><param name="quality" value="high"><param name="bgcolor" value="#000000"><param name="flashvars" value="config={&quot;plugins&quot;:{&quot;f4m&quot;:{&quot;url&quot;:&quot;http://aqsatv.ps/live/swf/flowplayer.f4m-3.2.10.swf&quot;,&quot;dvrBufferTime&quot;:12,&quot;liveBufferTime&quot;:12},&quot;httpstreaming&quot;:{&quot;url&quot;:&quot;http://aqsatv.ps/live/swf/flowplayer.httpstreaming-3.2.11.swf&quot;},&quot;controls&quot;:{&quot;url&quot;:&quot;http://aqsatv.ps/live/swf/flowplayer.controls-3.2.16.swf&quot;,&quot;buttonColor&quot;:&quot;rgba(0, 0, 0, 0.9)&quot;,&quot;buttonOverColor&quot;:&quot;#000000&quot;,&quot;backgroundColor&quot;:&quot;#D7D7D7&quot;,&quot;backgroundGradient&quot;:&quot;medium&quot;,&quot;sliderColor&quot;:&quot;#FFFFFF&quot;,&quot;sliderBorder&quot;:&quot;1px solid #808080&quot;,&quot;volumeSliderColor&quot;:&quot;#FFFFFF&quot;,&quot;volumeBorder&quot;:&quot;1px solid #808080&quot;,&quot;timeColor&quot;:&quot;#000000&quot;,&quot;durationColor&quot;:&quot;#535353&quot;}},&quot;clip&quot;:{&quot;url&quot;:&quot;http://live.aqsatv.atyaf.co:1935/aqsatv/live/tv/manifest.f4m&quot;,&quot;ipadUrl&quot;:&quot;http://live.aqsatv.atyaf.co:1935/aqsatv/live/tv/playlist.m3u8&quot;,&quot;urlResolvers&quot;:[&quot;f4m&quot;],&quot;provider&quot;:&quot;httpstreaming&quot;,&quot;autoPlay&quot;:true,&quot;live&quot;:true},&quot;playerId&quot;:&quot;player&quot;,&quot;playlist&quot;:[{&quot;url&quot;:&quot;http://live.aqsatv.atyaf.co:1935/aqsatv/live/tv/manifest.f4m&quot;,&quot;ipadUrl&quot;:&quot;http://live.aqsatv.atyaf.co:1935/aqsatv/live/tv/playlist.m3u8&quot;,&quot;urlResolvers&quot;:[&quot;f4m&quot;],&quot;provider&quot;:&quot;httpstreaming&quot;,&quot;autoPlay&quot;:true,&quot;live&quot;:true}]}"></object>'
	},
	{
		name: 'i24news',
		type: 'html',
		src: '<object width="100%" height="100%" type="application/x-shockwave-flash" data="http://c.brightcove.com/services/viewer/federated_f9?&amp;width=470&amp;height=350&amp;flashID=myExperience2552000984001&amp;bgcolor=%23000000&amp;playerID=2551661482001&amp;playerKey=AQ~~%2CAAACL1AyZ1k~%2ChYvoCrzvEtsjnBzkMXyn0g7qGNI0eDJy&amp;isVid=true&amp;isUI=true&amp;autoStart=true&amp;htmlFallback=true&amp;dynamicStreaming=true&amp;%40videoPlayer=2552000984001&amp;includeAPI=true&amp;templateLoadHandler=onTemplateLoad&amp;templateReadyHandler=brightcove%5B%22templateReadyHandlermyExperience2552000984001%22%5D&amp;debuggerID=&amp;originalTemplateReadyHandler=onTemplateReady&amp;startTime=1396304197501" id="myExperience2552000984001" class="BrightcoveExperience" seamlesstabbing="undefined"><param name="allowScriptAccess" value="always"><param name="allowFullScreen" value="true"><param name="seamlessTabbing" value="false"><param name="swliveconnect" value="true"><param name="wmode" value="window"><param name="quality" value="high"><param name="bgcolor" value="#000000"></object>',
		visible: false
	},
	{
		name: 'PressTV',
		type: 'jwplayer',
		src: 'http://ptv-hls.streaming.overon.es/channel03/livehigh.m3u8',
		bufferlength: 10,
		visible: false
	},
	{
		name: 'RT News',
		type: 'jwplayer',
		src: 'http://odna.octoshape.net/f3f5m2v4/cds/smil:ch1_auto.smil/playlist.m3u8',
		bufferlength: 8,
		visible: false
	},
	{
		name: 'Ukraine Today',
		type: 'iframe',
		src: 'http://www.youtube.com/embed/MeKNjoegIZ4?rel=0',
		visible: false
	},
	{
		name: 'CBS',
		type: 'jwplayer',
		src: 'rtmp://cp56371.live.edgefcs.net:443/live?ovpfv=1.1/CBSnews2_live_800@50979',
		bufferlength: 20
	},
	{
		name: 'ynet',
		type: 'html',
		src: '<object width="100%" height="100%" id="player_api" data="http://mediadownload.ynet.co.il/zeri/flowplayer.commercial-3.2.7.swf" type="application/x-shockwave-flash"><param name="allowfullscreen" value="true"><param name="allowscriptaccess" value="always"><param name="quality" value="high"><param name="cachebusting" value="false"><param name="bgcolor" value="#000000"><param name="flashvars" value="config={&quot;debug&quot;:false,&quot;key&quot;:&quot;#$82d88990cf33aa2235a&quot;,&quot;logo&quot;:{&quot;url&quot;:&quot;http://mediadownload.ynet.co.il/flowplayerlive/logoynetlive.png&quot;,&quot;top&quot;:10,&quot;left&quot;:10,&quot;fullscreenOnly&quot;:false,&quot;zIndex&quot;:11},&quot;plugins&quot;:{&quot;controls&quot;:{&quot;url&quot;:&quot;http://mediadownload.ynet.co.il/zeri/flowplayer.controls-3.2.5.swf&quot;,&quot;time&quot;:false},&quot;akamai&quot;:{&quot;url&quot;:&quot;http://players.edgesuite.net/flash/plugins/flow/v2.11/AkamaiFlowPlugin.swf&quot;},&quot;gatracker&quot;:{&quot;url&quot;:&quot;http://mediadownload.ynet.co.il/flowplayerlive/flowplayer.analytics-3.2.2.swf&quot;,&quot;events&quot;:{&quot;all&quot;:true},&quot;accountId&quot;:&quot;UA-17826742-7&quot;},&quot;hiro&quot;:{&quot;url&quot;:&quot;http://mediadownload.ynet.co.il/flowplayerlive/Flowplayer_Hiro_Ynet_2_9_0_15409.swf&quot;,&quot;flavor&quot;:&quot;YNET&quot;,&quot;site_id&quot;:&quot;9998&quot;}},&quot;clip&quot;:{&quot;url&quot;:&quot;http://ynet_hds_live-f.akamaihd.net/z/ynet_1@146348/manifest.f4m&quot;,&quot;provider&quot;:&quot;akamai&quot;,&quot;live&quot;:true,&quot;eventCategory&quot;:&quot;2014/08/03-20:43-News/Politics/ArmyAndSecurity-Other-aza&quot;},&quot;playerId&quot;:&quot;player&quot;,&quot;playlist&quot;:[{&quot;url&quot;:&quot;http://ynet_hds_live-f.akamaihd.net/z/ynet_1@146348/manifest.f4m&quot;,&quot;provider&quot;:&quot;akamai&quot;,&quot;live&quot;:true,&quot;eventCategory&quot;:&quot;2014/08/03-20:43-News/Politics/ArmyAndSecurity-Other-aza&quot;}]}"></object>'
	},
	{
		name: 'TV2',
		type: 'jwplayer',
		src: 'http://hls.akamai.tv2.no/wzlive/_definst_/amlst:WS26/831749.smil/manifest.m3u8',
		bufferlength: 10,
		visible: false
	},
	{
		name: 'AA',
		type: 'iframe',
		src: 'http://static.str.noccdn.net/tvkur.com/aa/live1.html',
		visible: false
	},
	{
		name: 'Jehad',
		type: 'iframe',
		src: 'http://www.ustream.tv/embed/12632661?v=3&amp;wmode=direct',
		visible: false
	},
	{
		name:'Occupiedair',
		type:'iframe',
		src:'http://www.ustream.tv/embed/10016873?v=3&amp;wmode=direct',
		visible: false
	},
	{
		name:'Cats',
		type:'iframe',
		src:'http://www.ustream.tv/embed/2298576?v=3&amp;wmode=direct'
	},	
	{
		name: 'Chat',
		type: 'html',
		src: '<script id="cid0020000066695717479" src="//st.chatango.com/js/gz/emb.js" async style="width:100%;height:100%;">{"handle":"happeningmonitor","arch":"js","styles":{"a":"cc0000","b":100,"c":"FFFFFF","d":"FFFFFF","k":"cc0000","l":"cc0000","m":"cc0000","n":"FFFFFF","q":"cc0000","r":100,"t":0,"usricon":0.99,"allowpm":0}}</script>'
	}
];


var colors = ['#DE8D47', '#A92F41', '#E5DFC5', '#B48375', '#91C7A9', '#607625', '#707070', '#FFCC00', '#6600CC'];

// https://github.com/k3oni/plugin.video.world.news.live/blob/master/channels.py

$('#editStreamDlg').dialog({
	zautoOpen: false,
	width: 400
});

var vm = window.v = new StreamzVM(streams);

var userData = localStorage["streamzData"];
if (userData) {
	userData = JSON.parse(userData);
	if (userData.ver === ver)
		vm.load(userData);
	else
		localStorage.removeItem("streamzData");
}

ko.applyBindings(vm);