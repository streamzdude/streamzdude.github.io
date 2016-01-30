var $ = require('jquery');
require('jquery-ui');
var ko = require('knockout');
var Firebase = require('firebase');

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
	this.isServerStream = ko.observable(false);

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

	this.newsItems = ko.observable([]);
	this.showNews = ko.observable(false);
	this.newsVisible = ko.computed(function() {
		var sawNewsAt = parseInt(localStorage["streamzSawNews"] ,10) || 0;
		var daysSinceSawNews = (Date.now() - sawNewsAt) / (1000*60*60*24);		
		return daysSinceSawNews > 14 && self.showNews() && self.newsItems().length > 0;
	});
	this.closeNews = function() {
		localStorage["streamzSawNews"] = Date.now();
		self.showNews(false);
	};

	this.tileWindows = function() {
		var oldPositions = self.windows().map(function(window) {
			return {
				name: window.stream.name(),
				left: window.left(),
				top: window.top(),
				width: window.width(),
				height: window.height()
			};
		});

		
	};

	var shoutboxName;
	if (localStorage["streamzShoutboxName"])
		shoutboxName = localStorage["streamzShoutboxName"];
	else {
		localStorage["streamzShoutboxName"] = shoutboxName = ('anon' + Math.floor(Math.random()*1000));
	}

	this.shoutbox = {
		items: ko.observableArray([]),
		message: ko.observable(''),
		name: ko.observable(shoutboxName)
			    .extend({rateLimit: {method: "notifyWhenChangesStop", timeout: 300}}),
		onKeyPress: function(data, event) {
			if (event.which !== 13) return true;
			if (self.shoutbox.message().trim().length === 0 || 
				self.shoutbox.name().trim().length === 0) return true;

			firebase.child("shoutbox").push({
				msg: self.shoutbox.message(),
				name: self.shoutbox.name(),
				time: Firebase.ServerValue.TIMESTAMP,
				sessionId: analyticsSession.key(),
				ip: ip
			});

			self.shoutbox.message('');
		}
	};

	// scroll shoutbox to bottom when items are updated:
	this.shoutbox.items.subscribe(function() {
		var container = $('.shoutbox-items-container')[0];
		if (!container) return;

		var isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 1;
		setTimeout(function() {
			if (isScrolledToBottom) 
        		container.scrollTop = container.scrollHeight - container.clientHeight;
		}, 0);
	});

	this.shoutbox.name.subscribe(function(name) {		
		localStorage["streamzShoutboxName"] = shoutboxName = name;
	});

	this.editedStream = {
		origStream: ko.observable(null),
		name: ko.observable(''),
		type: ko.observable('jwplayer'),
		src: ko.observable(''),

		open: function() { $('#editStreamDlg').dialog('open') },
		close: function() { $('#editStreamDlg').dialog('close') },
		remove: function() {
			var stream = this.origStream();
			if (!stream) return;
			if (!confirm('Are you sure you want to remove the stream "' + stream.name() + '"?')) return;

			if (stream.window()) {
				self.windows.remove(stream.window());
			}

			self.streams.remove(stream);
			self.save();
			this.close();
		},
		ok: function() {
			if (this.origStream()) { // editing existing stream
				var stream = this.origStream();
				var win = stream.window();
				var removeWin = win && (this.type() !== stream.type() || this.src() !== stream.src());

				if (removeWin) {
					self.windows.remove(win);
				}

				var editData = {
					from: {name: stream.name(), type: stream.type(), src: stream.src()},
					to: {name: this.name(), type: this.type(), src: this.src()}
				};

				stream.name(this.name()).type(this.type()).src(this.src());

				if (removeWin) {
					self.windows.push(win);
				}
				analyticsSession.child('editStream').push(editData);
			}
			else { // creating new stream
				var streamData = {name: this.name(), type: this.type(), src: this.src()};
				var stream = new Stream(streamData);
				self.streams.splice(0, 0, stream);
				analyticsSession.child('addStream').push(streamData);
			}

			this.close();			
			self.save(); // save changes to localstorage
		}
	};

	this.bringToFront = function(win) {
		var sortedWindows = self.windows().slice().sort(function(a,b) { return a.zIndex() - b.zIndex() });
		if (~sortedWindows.indexOf(win))
			sortedWindows.splice(sortedWindows.indexOf(win), 1);
		sortedWindows.push(win);
		sortedWindows.forEach(function(wind, i) { wind.zIndex(10 + i) });
	};

	this.addStream = function() {
		self.editedStream.origStream(null).name('');
		self.editedStream.open();
	}

	this.editStream = function(stream) {
		if (stream.type() === 'shoutbox') return;
		self.editedStream.origStream(stream).name(stream.name()).type(stream.type()).src(stream.src());
		self.editedStream.open();
	}

	this.windowBtnClicked = function(stream, e) {
		if (e.ctrlKey) {
			self.editStream(stream);
		}
		else {
			self.toggleWindow(stream);
		}
	}

	this.toggleWindow = function(stream) {
		var win = self.windows().filter(function(wind) { return wind.stream === stream })[0];
		if (win) {
			self.closeWindow(win);
		}
		else {
			win = new Window(stream);
			self.bringToFront(win);
			self.windows.push(win);
			stream.window(win);
			self.save();
		}
	}

	this.closeWindow = function(win) {
		win.stream.window(null);
		self.windows.remove(win);
		self.save();
	}

	this.reloadWindow = function(win) {
		self.windows.remove(win);
		self.windows.push(win);
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
		var windows = self.windows().map(function(win) { return win.save() });
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

		var windows = data.windows.map(function(winData) {
			var stream = self.findStream(winData.streamName);
			if (!stream) return;
			var win = new Window(stream);
			win.load(winData);
			return win;
		}).filter(function(win) { return !!win });

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
	    autostart: true,
	    rtmp: {
	    	subscribe: true,
	    	bufferlength: stream.bufferlength || 10
	    }
	});
}

function winYoutube(elem, src) {
	if (src.indexOf('http') === 0) {
		src = src.slice(src.lastIndexOf('/') + 1);
		if (src.indexOf('watch?v=') === 0)
			src = src.slice(8);
		else if (src.indexOf('?') > 0)
			src = src.slice(0, src.indexOf('?'));

	}
	src = 'https://www.youtube.com/embed/' + src + '?rel=0&autoplay=1&showinfo=1';
	winIframe(elem, src);
}

function winIframe(elem, src)
{
	$('<iframe allowfullscreen webkitallowfullscreen="true" height="100%" width="100%" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" />')
		.prop('src', src)
		.appendTo(elem);
}

function winShoutbox(elem) {
	$('<!-- ko template: "shoutbox-template"--><!-- /ko -->').appendTo(elem.find('.player'));
	$('<span class="shoutbox-title">... comments, spam, whatever ...</span>').appendTo(elem.find('.title'));
	setTimeout(function(){
		$('main').prop({scrollTop: 0, scrollLeft: 0}); // focus on shoutbox's input causes <main> to be scrolled if the input was out of view
		var container = $('.shoutbox-items-container')[0];
		container.scrollTop = container.scrollHeight - container.clientHeight;
	}, 0);
}

// allow changing resizable's "aspectRatio" option after initialization (http://bugs.jqueryui.com/ticket/4186)
var oldSetOption = $.ui.resizable.prototype._setOption;
$.ui.resizable.prototype._setOption = function(key, value) {
    oldSetOption.apply(this, arguments);
    if (key === "aspectRatio") {
        this._aspectRatio = !!value;
    }
};


var timeagoSettings = {
      allowFuture: false,
      strings: {
        prefixAgo: null,
        prefixFromNow: null,
        suffixAgo: "ago",
        suffixFromNow: "from now",
        inPast: 'any moment now',
        seconds: "less than a minute",
        minute: "about a minute",
        minutes: "%d minutes",
        hour: "about an hour",
        hours: "about %d hours",
        day: "a day",
        days: "%d days",
        month: "about a month",
        months: "%d months",
        year: "about a year",
        years: "%d years",
        wordSeparator: " ",
        numbers: []
      }
};

function timeago(timestamp) {   
    var distanceMillis = Date.now() - timestamp;
    var $l = timeagoSettings.strings;
    var prefix = $l.prefixAgo;
    var suffix = $l.suffixAgo;
    if (timeagoSettings.allowFuture) {
        if (distanceMillis < 0) {
            prefix = $l.prefixFromNow;
            suffix = $l.suffixFromNow;
        }
    }

    var seconds = Math.abs(distanceMillis) / 1000;
    var minutes = seconds / 60;
    var hours = minutes / 60;
    var days = hours / 24;
    var years = days / 365;

    function substitute(stringOrFunction, number) {
        var string = typeof stringOrFunction === 'function' ? stringOrFunction(number, distanceMillis) : stringOrFunction;
        var value = ($l.numbers && $l.numbers[number]) || number;
        return string.replace(/%d/i, value);
    }

    var words = seconds < 45 && substitute($l.seconds, Math.round(seconds)) ||
        seconds < 90 && substitute($l.minute, 1) ||
        minutes < 45 && substitute($l.minutes, Math.round(minutes)) ||
        minutes < 90 && substitute($l.hour, 1) ||
        hours < 24 && substitute($l.hours, Math.round(hours)) ||
        hours < 42 && substitute($l.day, 1) ||
        days < 30 && substitute($l.days, Math.round(days)) ||
        days < 45 && substitute($l.month, 1) ||
        days < 365 && substitute($l.months, Math.round(days / 30)) ||
        years < 1.5 && substitute($l.year, 1) ||
        substitute($l.years, Math.round(years));

    var separator = $l.wordSeparator || "";
    if ($l.wordSeparator === undefined) { separator = " "; }
    return [prefix, words, suffix].join(separator).trim()
}


var timeagoTimer;
var numTimeago = 0;

function timeagoUpdate() {
	$('.timeago').each(function() {
		var el = $(this);
		var from = el.text();
		var to = timeago( el.data('timestamp') );
		if (from !== to) {
			el.text( to );
		}
	});
}

ko.bindingHandlers.timeago = {
	init: function(element, valueAccessor) {
		var timestamp = ko.unwrap( valueAccessor() );
		var elem = $(element);

		elem.addClass('timeago')
			.data('timestamp', timestamp)			
			.text( timeago(timestamp) )

		if (numTimeago === 0) {
			timeagoTimer = setInterval(timeagoUpdate, 60000);
		}
		numTimeago++;

		ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
			elem.removeClass('timeago')
				.removeData('timestamp');
			numTimeago--;
			if (numTimeago === 0) {
				clearInterval(timeagoTimer);
				timeagoTimer = null;
			}
		});
	},
	update: function(element, valueAccessor) {
		var timestamp = ko.unwrap( valueAccessor() );
		$(element).data('timestamp', timestamp)
				  .text( timeago(timestamp) );
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
			cancel: 'object, .no-drag, input,textarea,button,select,option',
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
			case 'iframe': winIframe(playerDiv, stream.src()); break;
			case 'youtube': winYoutube(playerDiv, stream.src()); break;
			case 'html': playerDiv.append( stream.src() ); break;
			case 'shoutbox': winShoutbox(elem); break;
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
		var o = {child: f, transaction: f, update: f, push: f, set: f, key: function(){ return 'no-analytics' }};
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
			ip = data.query;
			session.update({ipData:data, ip: ip});
		}).fail(function() {
			$.get('http://icanhazip.com').done(function(data) {
				ip = data.trim();
				session.update({ip: ip});
			});
		});

		return session;
	}
}

var firebase = new Firebase("https://streamz.firebaseio.com/");
var noAnalytics = localStorage['no-analytics'] === 'true';
var ip = 'n/a';
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
			vmStream.type(serverStream.type).src(serverStream.src).isServerStream(true);
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


firebase.child("news").limitToLast(10).on("value", function(snapshot) {
	var items = snapshot.val();
	if (!items) return;
	items = Object.keys(items).map(function(key) { return items[key]; });
	vm.newsItems(items).showNews(true);
	setTimeout(function() { vm.showNews(false) }, 20000);
});


firebase.child("shoutbox").limitToLast(100).on("value", function(snapshot) {	
	var items = snapshot.val();
	if (!items) return;
	items = Object.keys(items).map(function(key) { return items[key]; });
	vm.shoutbox.items(items);
});


firebase.child("admin/obsoleteStreams").once("value", function(snapshot) {
	var streams = (snapshot.val() || "").split(",");
	var removedStreams = [];
	streams.forEach(function(deadStreamName) {
		var stream = vm.streams().filter(function(vmStream) { return vmStream.name() === deadStreamName })[0];
		if (!stream) return;
		if (stream.window()) {
			vm.windows.remove(stream.window());
		}

		removedStreams.push(stream.name())
		vm.streams.remove(stream);
		console.log('removing obsolete stream: ', stream.name());
	});
	if (removedStreams.length > 0) {		
		vm.save();
		analyticsSession.child('removeObsolete').transaction(function(val) { return (val||'')+removedStreams.join(', ') });
	}
});

