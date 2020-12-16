const mysql2 = require('mysql2/promise');
const uuid = require('uuid');
const fs = require('fs').promises;
const md5 = require('md5');

const args = processArguments();
if (args.command.length < 2 || args.arguments.help) {
	console.log(`Usage: ./create-system-user.js [...options] <host> <database>
Options:
  --user         Username to use when connecting to the database (default: root)
  --password     Password to use when connecting to the database
  --port         Port to use when connecting to the database (default: 3306)
  --examples     Path to examples config file (default: examples/examples.json`);
	process.exit(1);
}

run().catch(e => {
	console.error(e);
	process.exit(Number(e.errno) || 2);
});

async function run() {
	const conn = await mysql2.createConnection({
		host: args.command[0],
		database: args.command[1],
		user: args.arguments.user || 'root',
		port: Number(args.arguments.port) || 3306,
		password: args.arguments.password
	});

	await conn.connect();
	const examples = JSON.parse(await fs.readFile(args.arguments.examples || 'examples/examples.json', 'utf8'));

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

	let i = 0;
	for (const example of examples) {
		const elements = await fs.readFile(example.elements, 'utf8');
		const projectId = [(i++ + '').padEnd(8), ...uuid.v4().split('-').slice(1)].join('-');

		await conn.execute(`INSERT INTO project (
				id,
				name,
				description,
				link,
				public,
				userId,
				forkedFromId
			) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
				projectId,
				example.name,
				example.description,
				example.link || uuid.v4(),
				false,
				'00000000-0000-0000-0000-000000000000',
				null
			]
		);

		await conn.execute(`INSERT INTO project_file (
				id,
				filename,
				mimeType,
				hash,
				projectId
			) VALUES (?, ?, ?, ?, ?)`, [
				uuid.v4(),
				uuid.v4(),
				'application/json',
				md5(elements),
				projectId
			]
		);

		if (example.previewLight) {
			const file = await fs.readFile(example.previewLight);
			await conn.execute(`INSERT INTO project_preview_light (
					id,
					filename,
					mimeType,
					hash,
					projectId
				) VALUES (?, ?, ?, ?, ?)`, [
					uuid.v4(),
					uuid.v4(),
					'image/png',
					md5(file),
					projectId
				]
			);
		}
		if (example.previewDark) {
			const file = await fs.readFile(example.previewDark);
			await conn.execute(`INSERT INTO project_preview_dark (
					id,
					filename,
					mimeType,
					hash,
					projectId
				) VALUES (?, ?, ?, ?, ?)`, [
					uuid.v4(),
					uuid.v4(),
					'image/png',
					md5(file),
					projectId
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
