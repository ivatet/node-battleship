(function(exports){

	exports.ClientRequests = {
		ON_JOIN: 'on_join',
		ON_ATTACK: 'on_attack'
	};

	exports.ServerResponses = {
		ON_JOIN: 'on_join',
		ON_YOUR_ATTACK: 'on_your_attack',
		ON_THEY_ATTACK: 'on_they_attack',
		ON_FINISH: 'on_finish',
		ON_MESSAGE: 'on_message'
	};

})(typeof exports === 'undefined' ? window.utils = {} : exports);
