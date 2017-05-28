var $ = require('jquery');
var ko = require('knockout');
var firebase = require('firebase');
var moment = require('moment');

function toArray(obj) {
	return Object.keys(obj || {}).map(function(key) { return obj[key] });
}

function Stream(stream) {
	var self = this;
	stream = stream || {};
	$.extend(this, stream);
	this.visible = ko.observable(stream.visible !== false);
	this.name = ko.observable(stream.name || '');
	this.type = ko.observable(stream.type || 'jwplayer');
	this.src = ko.observable(stream.src || '');

	this.save = function() {
		var obj = {
			type: self.type(),
			src: self.src(),
			visible: self.visible()
		};
		['bufferlength', 'image', 'width', 'height'].forEach(function(prop) {
			if (typeof self[prop] !== 'undefined') {
				obj[prop] = self[prop];
			}
		});
		return obj;
	}
}

function Session(data) {
	data = data || {};
	$.extend(this, data);
	
	this.ip = data.ip || (data.ipData && data.ipData.query) || 'n/a';
	this.ipData = data.ipData || null;
	this.uid = data.uid || '';
	this.username = users[this.uid] ? users[this.uid].name : '';
	if (this.username.length === 36 && this.username[8] === '-') { 
		this.username = this.username.slice(0, 4) + '...';
	}
	this.location = data.ipData && (data.ipData.country + (data.ipData.city ? '/' + data.ipData.city : '')) ||  '';
	this.timeStr = 'n/a';
	this.duration = 'n/a';
	this.streamsStr = toArray(data.openWindow).map(function(name) { return name || '<empty>' }).join(', ');
	this.adds = toArray(data.addStream);
	this.edits = toArray(data.editStream);
	this.toggleCustomize = this.toggleCustomize || 0;

	if (data.started) {
		this.timeStr = moment(data.started).format("D/M/Y HH:mm:ss");
		var h = 0, m = 0, s = Math.round(moment.duration((data.ended || Date.now()) - data.started).asSeconds());
		if (s >= 60) {
			m = Math.floor(s / 60);
			s = s % 60;
		}
		if (m >= 60) {
			h = Math.floor(m / 60);
			m = m % 60;
		}
		this.duration = (h ? h + ' hr' + (h>1?'s ':' ') : '') + (m ? m + ' min' + (m>1?'s ':' ') : '') + s + ' sec' + (s!==1?'s':'');
		if (!data.ended) {
			this.duration += '~';
		}
	}
}

function VM() {
	var self = this;

	this.initialized = ko.observable(false);
	this.authData = ko.observable(null);
	this.streams = ko.observableArray();
	this.sessions = ko.observableArray();

	this.newStream = new Stream();
	this.newStream.hasFocus = ko.observable(true);

	this.sessionsLimit = ko.observable(50);

	this.removeStream = function(stream) {
		self.streams.remove(stream);
	};

	this.saveStream = function(stream) {
		db.child('admin/streams').child(stream.name() || '-').update(stream.save(), function(err) {
			if (err) return console.log(err);
			console.log('saved stream', stream);
		});
	}

	this.save = function() {
		if (!confirm('Sure you wanna overwrite all streams data?'))
			return;

		var streams = self.streams().reduce(function(currStreams, stream) {
			currStreams[stream.name() || '-'] = stream.save();
			return currStreams;
		}, {});

		var streamsOrder = self.streams().map(function(stream) { return stream.name().replace(/,/g,'') }).join(",");

		db.child('admin').update({streams: streams, streamsOrder: streamsOrder}, function(error) {
			if (error) {
				console.log("failed saving streams:", error);
				alert(error.message);
			}
		});
	};

	this.addStream = function() {
		var stream = {
			name: self.newStream.name(),
			type: self.newStream.type(),
			src: self.newStream.src(),
			visible: self.newStream.visible()
		};
		self.streams.push(new Stream(stream));
		self.newStream.name('').type('jwplayer').src('').hasFocus(true);
	};

	this.loadMoreStreams = function() {
		self.sessionsLimit(self.sessionsLimit() + 50);
		listenForSessions();
	}

	this.login = function () {
		var provider = new firebase.auth.GoogleAuthProvider();
		firebase.auth().signInWithPopup(provider).then(function(result) {
		    console.log("Authenticated successfully with payload:", result.user);
		    self.authData(result.user);
		    listenForSessions();
		    listenForStreams();
		}).catch(function(error) {
		    console.log("Login Failed!", error);
		});
	};

	this.logout = function() {
		firebase.auth().signOut();
		self.authData(null);
	}
}



function listenForStreams() {
	db.child("admin").on("value", function(snapshot) {
		var data = snapshot.val();
		console.log("received data:", data);

		var streams = data.streamsOrder.split(',')
			.map(function(name) {
				return new Stream($.extend({name:name}, data.streams[name]));
			});

		vm.streams(streams);

	}, function (error) {
  		console.log("Reading streams failed: ", error.code);
	});	
}

var users;

function listenForSessions() {
	if (sessionsRef) { sessionsRef.off("value"); }
	sessionsRef = db.child("stats/sessions").limitToLast(vm.sessionsLimit());
	sessionsRef.on("value", function(snapshot) {
		var data = snapshot.val();
		var sessions = toArray(data).map(function(session) { return new Session(session) }).reverse();
		console.log("sessions: ", sessions);
		vm.sessions(sessions);
	}, function (error) {
  		console.log("Reading sessions failed: ", error.code);
	});

}

function getUsers() {
	db.child("stats/users").on("value", function(snapshot) {
		users = snapshot.val();
		listenForSessions();
	});
}



var vm = new VM();
ko.applyBindings(vm);

var firebaseConfig = {
    apiKey: "AIzaSyB9h7b57i824rNibGYMN-s-4EuIJyXbqvk",
    authDomain: "streamz.firebaseapp.com",
    databaseURL: "https://streamz.firebaseio.com",
    storageBucket: "project-2755015809000717199.appspot.com",
};
firebase.initializeApp(firebaseConfig);

var db = firebase.database().ref();

var sessionsRef;

firebase.auth().onAuthStateChanged(function(user) {
	console.log('auth:', user)
	if (user) {
		vm.authData( user );
		getUsers();
		listenForStreams();
	}

	vm.initialized(true);
});

