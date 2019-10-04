module.exports = (config, options) => {
	config.module.rules.unshift({
		test: /\.ts$/,
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
					verbose: false,
				}
			}
		]
	});

	return config;
};
