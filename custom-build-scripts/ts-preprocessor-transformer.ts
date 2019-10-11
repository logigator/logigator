import * as ts from 'typescript';
const preprocessor = require('webpack-preprocessor-loader');

export function tsPreprocessorTransformer(preprocessorConfig: any) {
	return <T extends ts.Node>(context: ts.TransformationContext) => {
		return (rootNode: ts.SourceFile) => {
			const appliedPre = preprocessor.bind({query: preprocessorConfig});
			const processed = appliedPre(rootNode.text);
			rootNode.text = processed;
			return rootNode;
		};
	};
}
