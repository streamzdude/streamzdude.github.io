var Firebase = require('firebase');
var fetchIP = require('./fetch-ip');

var noAnalytics = localStorage['no-analytics'] === 'true';

module.exports = function initAnalytics(firebase) {
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

		fetchIP.then(function(data) {
			session.update(data);
		});

		return session;
	}
}


