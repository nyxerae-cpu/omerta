/* Minimal Cordova bridge stub for web/dev fallback.
	 Real Cordova builds replace this file during packaging. */
(function () {
	if (window.cordova) return;

	window.cordova = {
		platformId: 'browser',
		version: 'stub',
		plugins: window.cordova && window.cordova.plugins ? window.cordova.plugins : {},
	};

	// Emulate the key Cordova lifecycle event so app hooks can proceed in web fallback.
	setTimeout(function () {
		document.dispatchEvent(new Event('deviceready'));
	}, 0);
})();
