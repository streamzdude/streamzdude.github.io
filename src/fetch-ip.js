var $ = require('jquery');

var dfd = $.Deferred();
module.exports = dfd.promise();


$.getJSON('http://ip-api.com/json').done(function(data) {
	dfd.resolve({ipData:data, ip: data.query});
}).fail(function() {
	$.get('https://freegeoip.net/json/').done(function(data) {
		dfd.resolve({ip: data.ip, ipData: {countryCode: data.country_code, country: data.country_name}});
	}).fail(function() {
		$.get('https://icanhazip.com').done(function(data) {
			dfd.resolve({ip: data.trim()});
		}).fail(dfd.reject);
	});
});

