import {CustomWebpackBrowserSchema} from '@angular-builders/custom-webpack';
import * as path from 'path';

module.exports = (config, options: CustomWebpackBrowserSchema) => {
	config.module.rules.push({
		test: /\.md?$/,
		use: [
			{
				loader: path.resolve('custom-build-scripts/dist/markdown-postprocess-loader.js'),
			},
			'markdown-loader'
		]
	});

	config.target = 'web';

	const angularCompilerPlugin = findAngularCompilerPlugin(config);
	if (!angularCompilerPlugin) {
		console.error('Could not inject the typescript transformer: Webpack AngularCompilerPlugin not found');
		return;
	}

	angularCompilerPlugin.pluginOptions.directTemplateLoading = false;

	return config;
};

function findAngularCompilerPlugin(webpackCfg): any | null {
	for (const plugin of webpackCfg.plugins) {
		if ('directTemplateLoading' in (plugin?.pluginOptions ?? {})) {
			return plugin;
		}
	}
}
