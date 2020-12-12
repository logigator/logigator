function transform(targetOptions, indexHtml: string): string {
	return indexHtml
		.replace('<template id="compatibility-warning"></template>', '')
		.replace('##ga-page-placeholder##', '/editor/electron');
}

module.exports = transform;
