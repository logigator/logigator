import {AngularCompilerPlugin} from '@ngtools/webpack';
import {templateLoaderTransformer} from './template-loader-transformer';

module.exports = (config, options) => {
	config.module.rules.unshift({
		test: /\.tsx?$/,
		use: [
			{
				loader: 'webpack-preprocessor-loader',
				options: {
					debug:  process.env.DEBUG === 'true',
					directives: {
						project_recorder: process.env.PROJECT_RECORDER === 'true'
					},
					params: {
						PROJECT_RECORDER: process.env.PROJECT_RECORDER,
						DEBUG: process.env.DEBUG
					},
					verbose: true,
				}
			},
		]
	});

	const angularCompilerPlugin = findAngularCompilerPlugin(config);
	if (!angularCompilerPlugin) {
		console.error('Could not inject the typescript transformer: Webpack AngularCompilerPlugin not found');
		return;
	}

	addTransformerToAngularCompilerPlugin(angularCompilerPlugin, templateLoaderTransformer);

	return config;
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
