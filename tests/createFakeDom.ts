export function createFakeDom() {
	const JSDOM = require( 'jsdom' ).JSDOM;

	const jsdomOptions = {
		url: 'http://localhost/'
	};

	const jsdomInstance = new JSDOM( '', jsdomOptions );
	const { window } = jsdomInstance;

	Object.getOwnPropertyNames( window )
		.filter( property => !property.startsWith( '_' ) )
		.forEach( key => global[key] = window[key] );

	global['window'] = window;
	global['document'] = window.document;
	window.console = global.console;
}
