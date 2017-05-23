var firebase = require('firebase');
var fetchIP = require('./fetch-ip');

var noAnalytics = localStorage['no-analytics'] === 'true';

module.exports = function initAnalytics() {
	var db = firebase.database().ref();
	db.child('stats/hits').transaction(function(i){ return (i||0)+1 });
	if (noAnalytics) {
		var o = {child: f, transaction: f, update: f, push: f, set: f, key: 'no-analytics'};
		function f() { return o }
		return o;
	}
	else {
		var uid = localStorage['streamzUid'] || guid();
		localStorage['streamzUid'] = uid;
		var session = db.child('stats/sessions').push();
		session.update({
				browserDate: new Date().toString(),
				started: firebase.database.ServerValue.TIMESTAMP,
				uid: uid
		});
		session.onDisconnect().update({ended: firebase.database.ServerValue.TIMESTAMP});

		db.child("stats/users").child(uid).set({name: uid}, function(err) {});

		fetchIP.then(function(data) {
			session.update(data);
		});

		return session;
	}
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}