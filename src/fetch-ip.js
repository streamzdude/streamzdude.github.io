var $ = require('jquery');

var dfd = $.Deferred();
module.exports = dfd.promise();


$.getJSON('http://ip-api.com/json').done(function(data) {
	dfd.resolve({ipData:data, ip: data.query});
}).fail(function() {
	$.get('http://icanhazip.com').done(function(data) {
		dfd.resolve({ip: data.trim()});
	}).fail(dfd.reject);
});
