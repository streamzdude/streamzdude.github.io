var $ = require('jquery');
require('jquery-ui');
var ko = require('knockout');
var createShoutbox = require('./shoutbox');
var framebustbust = require('./framebustbust');

module.exports = StreamzVM;

function Stream(stream) {
	var self = this;
	$.extend(this, stream);
	this.visible = ko.observable(stream.visible !== false);
	this.window = ko.observable();
	this.name = ko.observable(stream.name);
	this.type = ko.observable(stream.type);
	this.src = ko.observable(stream.src);
	this.isServerStream = ko.observable(false);
	this.isFrameBuster = ko.observable(stream.isFrameBuster || false);

	this.save = function() {
		var stream = {
			name: self.name(),
			type: self.type(),
			src: self.src(),
			visible: self.visible(),
			isFrameBuster: self.isFrameBuster() || undefined
		};
		['bufferlength', 'image', 'width', 'height'].forEach(function(prop) {
			if (typeof self[prop] !== 'undefined') {
				stream[prop] = self[prop];
			}
		});
		return stream;
	};
}

var startLeft = 50, startTop = 50; // windows initial position

function Window(stream, vm, analytics) {
	var self = this;
	stream.window(this);

	analytics.child('openWindow').push(stream.name());

	this.stream = stream;
	this.left = ko.observable(startLeft);
	this.top = ko.observable(startTop);
	var initWidth = stream.width || (stream.type() === 'youtube' ? 587 : 600);
	var initHeight = stream.height || 345;
	this.width = ko.observable(initWidth);
	this.height = ko.observable(initHeight);
	this.zIndex = ko.observable(0);
	this.aspectRatioLocked = ko.observable(false);

	startLeft = (startLeft + 50) % 400; 
	startTop = (startTop + 50) % 400;

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
		self.left(data.left).top(data.top).width(data.width).height(data.height)
			.zIndex(data.zIndex)
			.aspectRatioLocked(!!data.aspectRatioLocked);
	}
}

function StreamzVM(analytics, dataVersion) {
	var self = this;

	this.windows = ko.observableArray();
	this.streams = ko.observableArray();

	this.visibleStreams = ko.computed(function() {
		return self.streams().filter(function(stream) { return stream.visible() });
	});

	this.headerStreams = ko.observableArray(); // use separate obsArray to enable sortable to modify it
	this.visibleStreams.subscribe(function(streams) {
		self.headerStreams(streams);
	});

	this.showOverlay = ko.observable(false);
	this.isCustomizing = ko.observable(false);
	this.showReload = ko.observable(true);
	this.showLocks = ko.observable(true);

	this.shoutbox = createShoutbox(analytics);

	this.headerStreamsSorted = function(data, e, ui) {
		// cancel sorting, and manually update the source streams observableArray:
		var headerStreams = data.sourceParent();
		var streams = self.streams();
		var movedStream = headerStreams[data.sourceIndex];
		var streamBefore = headerStreams[data.sourceIndex < data.targetIndex ? data.targetIndex : data.targetIndex-1];
		var origIndex = streams.indexOf(movedStream);
		var targetIndex = streams.indexOf(streamBefore) + 1;
		if (origIndex < targetIndex) targetIndex--;

		data.cancelDrop = true;

		// using setTimeout to wait until after cancel reverts the array:
		setTimeout(function() {
			var streams = self.streams();
			streams.splice(origIndex, 1);
			streams.splice(targetIndex, 0, movedStream);
			self.streams(streams);
			self.save();
		}, 0);
	};

	var isSorting = false; // prevent header buttons toggling a window during sorting (for firefox)
	this.sortableStart = function(e,ui) { isSorting = true; }
	this.sortableStop = function(e,ui) { setTimeout(function() { isSorting = false; }, 0); }

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
				analytics.child('editStream').push(editData);
			}
			else { // creating new stream
				var streamData = {name: this.name(), type: this.type(), src: this.src()};
				var stream = new Stream(streamData);
				self.streams.splice(0, 0, stream);
				analytics.child('addStream').push(streamData);
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

	this.newStreamObj = function(data) {
		return new Stream(data);
	}

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
		else if (!isSorting) {
			self.toggleWindow(stream);
		}
	}

	this.toggleWindow = function(stream) {
		var win = self.windows().filter(function(wind) { return wind.stream === stream })[0];
		if (win) {
			self.closeWindow(win);
		}
		else {
			win = new Window(stream, self, analytics);
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

		if (win.stream.isFrameBuster()) {
			var frameBusters = self.windows().filter(function(w) { return w.stream.isFrameBuster() });
			if (frameBusters.length === 0) {
				framebustbust(true);
			}
		}
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
			analytics.child('toggleCustomize').transaction(function(val) { return (val||0)+1 });
	}


	this.findStream = function(name) {
		return self.streams().filter(function(stream) { return stream.name() === name })[0];
	}

	this.enlargeWindow = function(win) {
		const main = $('main');
		const left = win.left(), top = win.top(), wid = win.width(), h = win.height(), right = left + wid, bottom = top + h;

		const wins = self.windows().filter(w => w !== win);

		const hWins = wins.filter(w => {
			let wleft = w.left(), wtop = w.top(), wwid = w.width(), wh = w.height(), wright = wleft + wwid, wbottom = wtop + wh;
			return wtop <= bottom && wbottom >= top;
		});

		const vWins = wins.filter(w => {
			let wleft = w.left(), wtop = w.top(), wwid = w.width(), wh = w.height(), wright = wleft + wwid, wbottom = wtop + wh;
			return wleft <= right && wright >= left;
		});

		const rWins = hWins.filter(w => w.left() >= right).sort((a,b) => a.left() - b.left());
		const lWins = hWins.filter(w => w.left()+w.width() <= left).sort((a,b) => a.left()+a.width() - (b.left()+b.width()));
		const tWins = vWins.filter(w => w.top()+w.height() <= top).sort((a,b) => a.top()+a.height() - (b.top()+b.height()));
		const bWins = vWins.filter(w => w.top() >= bottom).sort((a,b) => a.top() - b.top());


		const targetLeft = Math.max.apply(null, lWins.map(w => w.left() + w.width()).concat(0));
		const targetRight = Math.min.apply(null, rWins.map(w => w.left()).concat(main.width()));
		const targetTop =  Math.max.apply(null, tWins.map(w => w.top() + w.height()).concat(0));
		const targetBottom = Math.min.apply(null, bWins.map(w => w.top()).concat(main.height()));

		win.top(targetTop).left(targetLeft).width(targetRight-targetLeft).height(targetBottom-targetTop);

		$('body').addClass('animateWindows');

		const elem = $('.window').get().filter(w => ko.dataFor(w) === win)[0];
		$(elem).css({
			left: win.left() + 'px',
			top: win.top() + 'px',
			width: win.width() + 'px',
			height: win.height() + 'px'
		});

		self.save();
		setTimeout(function() {
			$('body').removeClass('animateWindows');
		}, 1200);
	}

	this.tileWindows = function(win, e) {		
		if (!e.ctrlKey && window.location.hash !== '#dekel') { 
			//return self.enlargeWindow(win);
			return;
		}
		
		// TODO: make this less gross & more flexible:		

		var windows = $('.window');
		if (windows.length === 0) return;
		var main = $('main');
		var rowsCols = [[1,1],[1,2],[1,3],[2,2],[2,3],[2,3],[3,3],[3,3],[3,3],[4,3],[4,3],[4,3],[4,4],[4,4],[4,4],[4,4],[5,4],[5,4],[5,4],[5,4]];
		var rows, cols;
		if (windows.length > rowsCols.length) {
			rows = 5; cols = 5;
		}
		else {
			rows = rowsCols[windows.length - 1][0];
			cols = rowsCols[windows.length - 1][1];
		}

		var width = main.width() / cols;
		var height = main.height() / rows;
		$('body').addClass('animateWindows');

		windows.each(function(i, elem) {
			var win = ko.dataFor(elem);				

			win.top(Math.floor(i / (cols))  * height).height(height)
			   .left((i % cols) * width).width(width);

			$(elem).css({
				left: win.left() + 'px',
				top: win.top() + 'px',
				width: win.width() + 'px',
				height: win.height() + 'px'
			});
		});

		self.save();
		setTimeout(function() {
			$('body').removeClass('animateWindows');
		}, 1200);

	};

	this.save = function() {
		var windows = self.windows().map(function(win) { return win.save() });
		var streamsVisibility = self.streams()
				.map(function(stream) { return {name:stream.name(), visible:stream.visible()} });

		var data = {
			ver: dataVersion,
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
			var win = new Window(stream, self, analytics);
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
