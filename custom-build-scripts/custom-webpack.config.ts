import {AngularCompilerPlugin} from '@ngtools/webpack';
import {templateLoaderTransformer} from './template-loader-transformer';

module.exports = (config, options) => {
	config.module.rules.unshift({
		test: /\.tsx?$/,
		use: [
			preprocessorConfig
		]
	});

	// const t = config.module.rules.find(r => {
	// 	return r.include && r.test.source ===  /\.scss$|\.sass$/.source && r.include.find(i => i.endsWith('styles.scss'));
	// });
	// t.use.unshift(preprocessorConfig);
	// console.log(t);

	config.module.rules.push({
		test: /\.html?$/,
		use: [
			'html-loader',
			preprocessorConfig
		]
	});

	if (process.env.ELECTRON === 'true') {
		config.target = 'electron-renderer';
	} else {
		config.target = 'web';
	}

	const angularCompilerPlugin = findAngularCompilerPlugin(config);
	if (!angularCompilerPlugin) {
		console.error('Could not inject the typescript transformer: Webpack AngularCompilerPlugin not found');
		return;
	}

	angularCompilerPlugin.options.directTemplateLoading = false;

	addTransformerToAngularCompilerPlugin(angularCompilerPlugin, templateLoaderTransformer);

	// console.log(config.module.rules);
	return config;
};

const preprocessorConfig = {
	loader: 'webpack-preprocessor-loader',
	options: {
		debug:  process.env.DEBUG === 'true',
		directives: {
			production:  process.env.DEBUG === 'false',
			electron: process.env.ELECTRON === 'true'
		},
		params: {
			ELECTRON: process.env.ELECTRON,
			DEBUG: process.env.DEBUG
		},
		verbose: true,
	}
};

function findAngularCompilerPlugin(webpackCfg): AngularCompilerPlugin | null {
	for (const plugin of webpackCfg.plugins) {
		if (plugin._transformers) {
			return plugin;
		}
	}
}

function addTransformerToAngularCompilerPlugin(acp, transformer): void {
	acp._transformers = [transformer, ...acp._transformers];
}
