import * as ts from 'typescript';

export const templateLoaderTransformer = <T extends ts.Node>(context: ts.TransformationContext) => {
	return (rootNode: ts.SourceFile) => {
		function visit(node: ts.Node): ts.Node {
			if (ts.isDecorator(node) && (node.expression as ts.CallExpression).expression.getText() === 'Component') {
				const arg = (node.expression as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression;
				const templateProp = arg.properties.find(p => p.name.getText() === 'templateUrl') as ts.PropertyAssignment;
				ts.createCall(ts.createIdentifier('require'), [], []);
			}
			return ts.visitEachChild(node, visit, context);
		}
		return ts.visitNode(rootNode, visit);
	};
};
