const fs = require('fs');
const path = require('path');

if (process.argv.length < 4) {
	console.log('Usage: ./project_transform.js [old project files]... [destination directory]');
	process.exit(1);
}

for (const file of process.argv.slice(2, -1)) {
	const json = JSON.parse(fs.readFileSync(file, {encoding: 'utf8'}));

	const project = {
		project: {
			name: json.mainProject.name,
			elements: convertElements(json.mainProject.data)
		},
		components: json.components.map(x => {
			return {
				info: {
					id: x.typeId,
					numInputs: x.type.numInputs,
					numOutputs: x.type.numOutputs,
					labels: x.type.labels,
					description: x.type.description,
					name: x.type.name,
					symbol: x.type.symbol
				},
				elements: convertElements(x.data)
			}
		})
	}

	fs.writeFileSync(path.join(process.argv[process.argv.length - 1], path.basename(file)), JSON.stringify(project), {encoding: 'utf8'});
}

function convertElements(elements) {
	return elements.map(x => {
		const element = {
			t: x.typeId,
			p: [x.pos.x, x.pos.y]
		}
		if (x.numOutputs)
			element.o = x.numOutputs;
		if (x.numInputs)
			element.i = x.numInputs;
		if (x.endPos)
			element.q = [x.endPos.x, x.endPos.y]
		if (x.rotation)
			element.r = x.rotation;
		if (x.plugIndex)
			element.n = [x.plugIndex];
		if (x.options) {
			if (element.n)
				element.n = [...element.n, ...x.options];
			else
				element.n = x.options;
		}
		if (x.data)
			element.s = x.data;
		return element;
	});
}
