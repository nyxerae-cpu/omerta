/* Minimal plugin registry stub for web/dev fallback. */
(function () {
	if (!window.cordova) {
		window.cordova = { platformId: 'browser', version: 'stub', plugins: {} };
	}
	if (!window.cordova.plugins) window.cordova.plugins = {};

	window.cordova.define = window.cordova.define || function () {};
	window.cordova.require = window.cordova.require || function () { return {}; };
	window.cordova.plugin_list = [];
})();
