import * as ts from 'typescript';

export const templateLoaderTransformer = <T extends ts.Node>(context: ts.TransformationContext) => {
	return (rootNode: ts.SourceFile) => {
		function visit(node: ts.Node): ts.Node {
			if (ts.isDecorator(node)) {
				console.log(node.expression.getFullText())
			}
			return ts.visitEachChild(node, visit, context);
		}
		return ts.visitNode(rootNode, visit);
	};
};
