var ver = 1;
var startLeft = 50, startTop = 50;

function Stream(stream) {
	var self = this;
	$.extend(this, stream);
	this.visible = ko.observable(stream.visible !== false);
	this.window = ko.observable();
	this.name = ko.observable(stream.name);
	this.type = ko.observable(stream.type);
	this.src = ko.observable(stream.src);

	this.save = function() {
		var stream = {
			name: self.name(),
			type: self.type(),
			src: self.src(),
			visible: self.visible()
		};
		['bufferlength', 'image', 'width', 'height'].forEach(function(prop) {
			if (typeof self[prop] !== 'undefined') {
				stream[prop] = self[prop];
			}
		});
		return stream;
	};
}

function Window(stream) {
	var self = this;
	stream.window(this);

	analyticsSession.child('openWindow').push(stream.name());

	this.stream = stream;
	this.left = ko.observable(startLeft);
	this.top = ko.observable(startTop);
	startLeft = (startLeft + 50) % 400; startTop = (startTop + 50) % 400;
	this.width = ko.observable(stream.width || 600);
	this.height = ko.observable(stream.height || 345);
	this.zIndex = ko.observable(0);
	this.aspectRatioLocked = ko.observable(false);

	this.toggleLock = function() {
		self.aspectRatioLocked(!self.aspectRatioLocked());
		vm.save();
	};

	this.save = function() {
		return {
			streamName: self.stream.name(),
			left: self.left(),
			top: self.top(),
			width: self.width(),
			height: self.height(),
			zIndex: self.zIndex(),
			aspectRatioLocked: self.aspectRatioLocked()
		};
	}

	this.load = function(data) {
		self.left(data.left).top(data.top).width(data.width).height(data.height).zIndex(data.zIndex).aspectRatioLocked(!!data.aspectRatioLocked);
	}
}

function StreamzVM() {
	var self = this;

	this.windows = ko.observableArray();
	this.streams = ko.observableArray();

	this.visibleStreams = ko.computed(function() {
		return self.streams().filter(function(stream) { return stream.visible() });
	});

	this.showOverlay = ko.observable(false);
	this.isCustomizing = ko.observable(false);
	this.showReload = ko.observable(true);
	this.showLocks = ko.observable(true);

	this.editedStream = {
		origStream: ko.observable(null),
		name: ko.observable(''),
		type: ko.observable('jwplayer'),
		src: ko.observable(''),

		open: function() { $('#editStreamDlg').dialog('open') },
		close: function() { $('#editStreamDlg').dialog('close') },
		ok: function() {
			if (this.origStream()) {
				var stream = this.origStream();
				var window = stream.window();
				var winRemoved = false;

				if (window && (this.type() !== stream.type() || this.src() !== stream.src())) {
					self.windows.remove(window);
					winRemoved = true;
				}

				stream.name(this.name()).type(this.type()).src(this.src());

				if (winRemoved) {
					self.windows.push(window);
				}
			}
			else {
				analyticsSession.child('addStream').push({stream: this.name(), type: this.type(), src: this.src()});
				var stream = new Stream({
					name: this.name(),
					type: this.type(),
					src: this.src()
				});
				self.streams.splice(0, 0, stream);
			}
			this.close();
			
			self.save(); // save changes to localstorage
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
		self.editedStream.origStream(stream).name(stream.name()).type(stream.type()).src(stream.src());
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
		else
			analyticsSession.child('toggleCustomize').transaction(function(val) { return (val||0)+1 });
	}


	this.findStream = function(name) {
		return self.streams().filter(function(stream) { return stream.name() === name })[0];
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
		var streamsVisibility = self.streams()
				.map(function(stream) { return {name:stream.name(), visible:stream.visible()} });

		var data = {
			ver: ver,
			windows: windows,
			streamsVisibility: streamsVisibility,
			showReload: self.showReload(),
			showLocks: self.showLocks(),
			streams: self.streams().map(function(stream) { return stream.save() })
		};

		localStorage["streamzData"] = JSON.stringify(data);
	}

	this.load = function(data)
	{
		if (data.streams) {
			self.streams(data.streams.map(function(stream) { return new Stream(stream) }));
		}

		self.streams().forEach(function(stream) {
			stream.window(null);
		});

		if (data.streamsVisibility) {
			data.streamsVisibility.forEach(function(streamVisibility) {
				var stream = self.findStream(streamVisibility.name)
				if (stream)
					stream.visible(streamVisibility.visible);
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
		if (typeof data.showLocks !== "undefined")
			self.showLocks(data.showLocks);
	}
}

var numPlayers = 0;
//jwplayer.key='5XXb+w0txH2+cnkwOtAOWXU39zFQbZ6VT9mOA6R83tk=';
jwplayer.key='cH3LS/5ip1cRnTAeAfHTSnww0iWLW/Vb62KpZK+nusI=';

function winJwplayer(elem, stream)
{
	var player = $('<div>').prop('id', 'player-' + (numPlayers++)).appendTo(elem);

	jwplayer(player[0]).setup({
	    file: stream.src(),
	    title: stream.name() || 'Untitled',
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
		.prop('src', stream.src())
		.appendTo(elem);
}

// allow changing resizable's "aspectRatio" option after initialization (http://bugs.jqueryui.com/ticket/4186)
var oldSetOption = $.ui.resizable.prototype._setOption;
$.ui.resizable.prototype._setOption = function(key, value) {
    oldSetOption.apply(this, arguments);
    if (key === "aspectRatio") {
        this._aspectRatio = !!value;
    }
};

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
			aspectRatio: window.aspectRatioLocked(),
			start: function() {	vm.showOverlay(true) },
			stop: function() {
				vm.showOverlay(false);
				var pos = elem.position();
				window.left(pos.left).top(pos.top).width(elem.width()).height(elem.height());
				vm.save();
			}
		});

		switch (stream.type()) {
			case 'jwplayer': winJwplayer(playerDiv, stream); break;
			case 'iframe': winIframe(playerDiv, stream); break;
			case 'html': playerDiv.append( stream.src() ); break;
		}

		ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
			if (stream.type() === 'jwplayer') {
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
		elem.resizable('option', 'aspectRatio', window.aspectRatioLocked());
	}
}



$('#editStreamDlg').dialog({
	autoOpen: false,
	width: 400
});


function initAnalytics() {
	firebase.child('stats/hits').transaction(function(i){ return (i||0)+1 });
	if (noAnalytics) {
		var o = {child: f, transaction: f, update: f, push: f, set: f};
		function f() { return o }
		return o;
	}
	else {
		var session = firebase.child('stats/sessions').push();
		session.update({
				browserDate: new Date().toString(),
				started: Firebase.ServerValue.TIMESTAMP
		});
		session.onDisconnect().update({ended: Firebase.ServerValue.TIMESTAMP});

		$.getJSON('http://ip-api.com/json').done(function(data) {
			ipData = data;
			session.update({ipData:data, ip: data.query});
		}).fail(function() {
			$.get('http://icanhazip.com').done(function(data) {
				session.update({ip: data.trim()});
			});
		});

		return session;
	}
}

var firebase = new Firebase("https://streamz.firebaseio.com/");
var noAnalytics = localStorage['no-analytics'] === 'true';
var ipData = {};
var analyticsSession = initAnalytics();
var localData = JSON.parse(localStorage["streamzData"] || '{}');

var vm = window.v = new StreamzVM();

if (localData.ver === ver)
	vm.load(localData);
else
	localStorage.removeItem("streamzData");


ko.applyBindings(vm);


firebase.child("admin").on("value", function(snapshot) {
	var data = snapshot.val();

	vm.streams().forEach(function(vmStream) {
		var serverStream = data.streams[vmStream.name()];
		if (serverStream) {
			vmStream.type(serverStream.type).src(serverStream.src);
			delete data.streams[vmStream.name()];
		}
	});

	var newStreams = data.streamsOrder.split(',')
		.filter(function(name) { return data.streams[name] })
		.map(function(name) {
			return new Stream($.extend({name:name}, data.streams[name]));
		});

	if (newStreams.length > 0)
		vm.streams(vm.streams().concat(newStreams));

	vm.save(); // save updated streams to local storage

}, function(error) {
	console.log("Reading streams failed: ", error.code);
});






