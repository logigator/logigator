import {AngularCompilerPlugin} from '@ngtools/webpack';
import {templateLoaderTransformer} from './template-loader-transformer';

module.exports = (config, options) => {
	config.module.rules.unshift({
		test: /\.tsx?$/,
		use: [
			preprocessorConfig
		]
	});
	config.module.rules.push({
		test: /\.html?$/,
		use: [
			'html-loader',
			preprocessorConfig
		]
	});

	const angularCompilerPlugin = findAngularCompilerPlugin(config);
	if (!angularCompilerPlugin) {
		console.error('Could not inject the typescript transformer: Webpack AngularCompilerPlugin not found');
		return;
	}

	angularCompilerPlugin.options.directTemplateLoading = false;

	addTransformerToAngularCompilerPlugin(angularCompilerPlugin, templateLoaderTransformer);

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
