function transform(targetOptions, indexHtml: string): string {
	return indexHtml.replace('<template id="compatibility-warning"></template>', '');
}

module.exports = transform;
