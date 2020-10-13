export default function(source: string): string {
	source = source.replace(/\.\.\/\.\.\/assets\//g, 'assets/');
	return 'module.exports = ' + JSON.stringify(source) + ';';
}
