const mysql2 = require('mysql2/promise');
const uuid = require('uuid');
const fs = require('fs').promises;
const md5 = require('md5');
const path = require('path');

const args = processArguments();
if (args.command.length < 2 || args.arguments.help) {
	console.log(`Usage: ./create-system-user.js [...options] <host> <database>

Options:
  --user                Username to use when connecting to the database (default: root)
  --password            Password to use when connecting to the database
  --port                Port to use when connecting to the database (default: 3306)
  --examples            Path to examples config file (default: examples/examples.json)
  --out-projects        Path to use for writing project files (default: out/projects/)
  --out-components      Path to use for writing component files (default: out/components/)
  --out-previews-dark   Path to use for writing preview files (default: out/previews-dark/)
  --out-previews-light  Path to use for writing preview files (default: out/previews-light/)`);
	process.exit(args.arguments.help ? 0 : 1);
}

run().catch(e => {
	console.error(e);
	process.exit(Number(e.errno) || 2);
});

async function run() {
	args.arguments.examples = path.normalize(args.arguments.examples || 'examples/examples.json');
	args.arguments.user = args.arguments.user || 'root';
	args.arguments.port = Number(args.arguments.port) || 3306;
	args.arguments['out-projects'] = path.normalize(args.arguments['out-projects'] || 'out/projects').replace(new RegExp(`\\${path.sep}$`), '');
	args.arguments['out-components'] = path.normalize(args.arguments['out-components'] || 'out/components').replace(new RegExp(`\\${path.sep}$`), '');
	args.arguments['out-previews-dark'] = path.normalize(args.arguments['out-previews-dark'] || 'out/previews-dark').replace(new RegExp(`\\${path.sep}$`), '');
	args.arguments['out-previews-light'] = path.normalize(args.arguments['out-previews-light'] || 'out/previews-light').replace(new RegExp(`\\${path.sep}$`), '');

	const conn = await mysql2.createConnection({
		host: args.command[0],
		database: args.command[1],
		user: args.arguments.user,
		port: args.arguments.port,
		password: args.arguments.password
	});

	await conn.connect();
	const examples = JSON.parse(await fs.readFile(args.arguments.examples, 'utf8'));

	await conn.execute(`DELETE FROM user WHERE id = '00000000-0000-0000-0000-000000000000'`);
	await conn.execute(`INSERT INTO user (
			id,
			username,
			email,
			password,
			googleUserId,
			twitterUserId,
			localEmailVerified
		) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
			'00000000-0000-0000-0000-000000000000',
			'system',
			'support@logigator.com',
			'',
			null,
			null,
			true
		]
	);

	/**
	 * Projects
	 */

	const projects = new Map();
	let i = 0;

	for (const project of examples.projects) {
		const elements = await fs.readFile(path.resolve(path.dirname(args.arguments.examples), project.elements), 'utf8');
		projects.set(project, [(i + '').padStart(8, '0'), ...uuid.v4().split('-').slice(1)].join('-'));

		await conn.execute(`INSERT INTO project (
				id,
				name,
				description,
				link,
				public,
				userId
			) VALUES (?, ?, ?, ?, ?, ?)`, [
				projects.get(project),
				project.name,
				project.description,
				project.link || uuid.v4(),
				false,
				'00000000-0000-0000-0000-000000000000'
			]
		);

		const filename = uuid.v4();
		await conn.execute(`INSERT INTO project_file (
				id,
				filename,
				mimeType,
				hash,
				projectId
			) VALUES (?, ?, ?, ?, ?)`, [
				uuid.v4(),
				filename,
				'application/json',
				md5(elements),
				projects.get(project)
			]
		);
		await fs.writeFile(path.join(args.arguments['out-projects'], filename + '.json'), elements);

		if (project.previewLight) {
			const file = await fs.readFile(path.resolve(path.dirname(args.arguments.examples), project.previewLight));
			const filename = uuid.v4();

			await conn.execute(`INSERT INTO project_preview_light (
					id,
					filename,
					mimeType,
					hash,
					projectId
				) VALUES (?, ?, ?, ?, ?)`, [
					uuid.v4(),
					filename,
					'image/png',
					md5(file),
					projects.get(project)
				]
			);
			await fs.writeFile(path.join(args.arguments['out-previews-light'], filename + '.png'), file);
		}
		if (project.previewDark) {
			const file = await fs.readFile(path.resolve(path.dirname(args.arguments.examples), project.previewDark));
			const filename = uuid.v4();

			await conn.execute(`INSERT INTO project_preview_dark (
					id,
					filename,
					mimeType,
					hash,
					projectId
				) VALUES (?, ?, ?, ?, ?)`, [
					uuid.v4(),
					filename,
					'image/png',
					md5(file),
					projects.get(project)
				]
			);
			await fs.writeFile(path.join(args.arguments['out-previews-dark'], filename + '.png'), file);
		}
		i++;
	}

	/**
	 * Components
	 */

	const components = new Map();

	for (const [key, component] of Object.entries(examples.components)) {
		const elements = await fs.readFile(path.resolve(path.dirname(args.arguments.examples), component.elements), 'utf8');
		components.set(key, uuid.v4());

		await conn.execute(`INSERT INTO component (
				id,
				name,
				description,
				symbol,
				numInputs,
				numOutputs,
				labels,
				link,
				public,
				userId
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
				components.get(key),
				component.name,
				component.description,
				component.symbol,
				component.numInputs,
				component.numOutputs,
				component.labels.join(','),
				component.link || uuid.v4(),
				false,
				'00000000-0000-0000-0000-000000000000'
			]
		);

		const filename = uuid.v4();
		await conn.execute(`INSERT INTO component_file (
				id,
				filename,
				mimeType,
				hash,
				componentId
			) VALUES (?, ?, ?, ?, ?)`, [
				uuid.v4(),
				filename,
				'application/json',
				md5(elements),
				components.get(key)
			]
		);
		await fs.writeFile(path.join(args.arguments['out-components'], filename + '.json'), elements);

		if (component.previewLight) {
			const file = await fs.readFile(path.resolve(path.dirname(args.arguments.examples), component.previewLight));
			const filename = uuid.v4();

			await conn.execute(`INSERT INTO component_preview_light (
					id,
					filename,
					mimeType,
					hash,
					componentId
				) VALUES (?, ?, ?, ?, ?)`, [
					uuid.v4(),
					filename,
					'image/png',
					md5(file),
					components.get(key)
				]
			);
			await fs.writeFile(path.join(args.arguments['out-previews-light'], filename + '.png'), file);
		}
		if (component.previewDark) {
			const file = await fs.readFile(path.resolve(path.dirname(args.arguments.examples), component.previewDark));
			const filename = uuid.v4();

			await conn.execute(`INSERT INTO component_preview_dark (
					id,
					filename,
					mimeType,
					hash,
					componentId
				) VALUES (?, ?, ?, ?, ?)`, [
					uuid.v4(),
					filename,
					'image/png',
					md5(file),
					components.get(key)
				]
			);
			await fs.writeFile(path.join(args.arguments['out-previews-dark'], filename + '.png'), file);
		}
	}

	/**
	 * Dependencies
	 */

	for (const project of examples.projects) {
		for (const dep of project.dependencies) {
			await conn.execute(`INSERT INTO project_dependency (
						model_id,
						dependentId,
						dependencyId
					) VALUES (?, ?, ?)`, [
					dep.model,
					projects.get(project),
					components.get(dep.dependency)
				]
			);
		}
	}

	for (const [key, component] of Object.entries(examples.components)) {
		for (const dep of component.dependencies) {
			await conn.execute(`INSERT INTO project_dependency (
						model_id,
						dependentId,
						dependencyId
					) VALUES (?, ?, ?)`, [
					dep.model,
					components.get(key),
					components.get(dep.dependency)
				]
			);
		}
	}

	process.exit(0);
}

function processArguments() {
	const processed = {
		flags: [],
		arguments: {},
		command: []
	};

	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i];

		if (arg.startsWith('--')) {
			processed.arguments[arg.substr(2)] = process.argv[++i];
		} else if (arg.startsWith('-')) {
			processed.flags = [...processed.flags, ...arg.substr(1)];
		} else {
			processed.command.push(arg);
		}
	}

	return processed;
}
