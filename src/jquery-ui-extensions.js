var $ = require('jquery');
require('jquery-ui');


// allow changing resizable's "aspectRatio" option after initialization (http://bugs.jqueryui.com/ticket/4186)
var oldSetOption = $.ui.resizable.prototype._setOption;
$.ui.resizable.prototype._setOption = function(key, value) {
    oldSetOption.apply(this, arguments);
    if (key === "aspectRatio") {
        this._aspectRatio = !!value;
    }
};


// do resizable's aspect-ratio lock for the inner player div instead of the whole window element:
var playerDiffW = 3+3, playerDiffH = 15+3;

$.ui.resizable.prototype._updateRatio = function( data ) {
	var cpos = this.position,
		csize = this.size,
		a = this.axis,
		pHeight, pWidth,
		playerRatio = this.playerAspectRatio;
    
	if (isNumber(data.height)) {
  		var pHeight = data.height - playerDiffH;
    	var pWidth = pHeight * playerRatio;
    	data.width = pWidth + playerDiffW;
	} else if (isNumber(data.width)) {
  		var pWidth = data.width - playerDiffW;
    	var pHeight = pWidth / playerRatio;
    	data.height = pHeight + playerDiffH;
	}

	if (a === "sw") {
		data.left = cpos.left + (csize.width - data.width);
		data.top = null;
	}
	if (a === "nw") {
		data.top = cpos.top + (csize.height - data.height);
		data.left = cpos.left + (csize.width - data.width);
	}

	return data;
}

function isNumber(value) {
	return !isNaN(parseInt(value, 10));
}
