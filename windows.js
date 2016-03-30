var $ = require('jquery');
var ko = require('knockout');

var numPlayers = 0;
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
			start: function(e, ui) {
				$.data(this, 'ui-resizable').playerAspectRatio = playerDiv.width() / playerDiv.height();
				vm.showOverlay(true);
			},
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