const mysql2 = require('mysql2/promise');
const uuid = require('uuid');
const fs = require('fs').promises;
const md5 = require('md5');

run();
async function run() {
	const conn = await mysql2.createConnection(require('./db_connection.json'));
	await conn.connect();

	await conn.execute('SET FOREIGN_KEY_CHECKS=0');
	await conn.execute('DELETE FROM logigator_new.project');
	await conn.execute('DELETE FROM logigator_new.component');
	await conn.execute('DELETE FROM logigator_new.profile_picture');
	await conn.execute('DELETE FROM logigator_new.user');
	await conn.execute('DELETE FROM logigator_new.component_dependency');
	await conn.execute('DELETE FROM logigator_new.component_preview_dark');
	await conn.execute('DELETE FROM logigator_new.component_preview_light');
	await conn.execute('DELETE FROM logigator_new.project_dependency');
	await conn.execute('DELETE FROM logigator_new.project_preview_dark');
	await conn.execute('DELETE FROM logigator_new.project_preview_light');
	await conn.execute('DELETE FROM logigator_new.component_file');
	await conn.execute('DELETE FROM logigator_new.project_file');
	await conn.execute('DELETE FROM logigator_new.shortcut');
	await conn.execute('SET FOREIGN_KEY_CHECKS=1');

	const mkdirError = (err) => {
		if (err.code !== 'EEXIST')
			throw err;
	};
	await fs.mkdir('resources').catch(mkdirError);
	await fs.mkdir('resources/public').catch(mkdirError);
	await fs.mkdir('resources/private').catch(mkdirError);
	await fs.mkdir('resources/public/profile').catch(mkdirError);
	await fs.mkdir('resources/public/preview').catch(mkdirError);
	await fs.mkdir('resources/public/preview/dark').catch(mkdirError);
	await fs.mkdir('resources/public/preview/light').catch(mkdirError);
	await fs.mkdir('resources/private/projects').catch(mkdirError);
	await fs.mkdir('resources/private/components').catch(mkdirError);

	/**
	 * Users
	 */

	const users = await conn.execute('SELECT * FROM logigator_old.users');
	const userIds = new Map();

	for (const u of users[0]) {
		if (u.login_type === 'local_not_verified')
			continue;
		const id = uuid.v4();
		await conn.execute(`INSERT INTO logigator_new.user (
				id,
				username,
				email,
				password,
				googleUserId,
				twitterUserId,
				localEmailVerified
			) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
				id,
				u.username,
				u.email,
				u.password,
				u.login_type === 'google' ? u.social_media_key : null,
				u.login_type === 'twitter' ? u.social_media_key : null,
				true
			]
		);
		if (u.profile_image) {
			await conn.execute(`INSERT INTO logigator_new.profile_picture (id, filename, mimeType, hash, userId)
			                    VALUES (?, ?, ?, ?, ?)`,
				[
					uuid.v4(),
					u.profile_image,
					'image/jpeg',
					md5(await fs.readFile(`images/profile/${u.profile_image}`)),
					id
				]
			)
			await fs.copyFile(`images/profile/${u.profile_image}`, `resources/public/profile/${u.profile_image}.jpg`);
		}
		userIds.set(u.pk_id, id);
	}

	/**
	 * Projects / Components
	 */

	const projects = await conn.execute('SELECT * FROM logigator_old.projects');
	const projectIds = new Map();
	projects[0].forEach(x => projectIds.set(x.pk_id, uuid.v4()));

	for (const project of projects[0]) {
		const file = JSON.parse(await fs.readFile(`projects/${project.location}`, 'utf8').catch(err => {
			if (err.code !== 'ENOENT')
				throw err;
			else
				return '{}';
		}));
		file.elements = convertElements(file.elements || []);

		if (project.is_component[0] === 1) {
			await conn.execute(`INSERT INTO logigator_new.component (
					id,
					name,
					description,
					createdOn,
					lastEdited,
					symbol,
					numInputs,
					numOutputs,
					labels,
					link,
					public,
					userId,
					forkedFromId
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
					projectIds.get(project.pk_id),
					project.name,
					project.description,
					project.created_on,
					project.last_edited,
					project.symbol,
					project.num_inputs,
					project.num_outputs,
					project.labels.replace(/;/g, ','),
					uuid.v4(),
					false,
					userIds.get(project.fk_user),
					project.fk_originates_from ? projectIds.get(project.fk_originates_from) : null
				]
			);

			await conn.execute(`INSERT INTO logigator_new.component_file (
					id,
					filename,
					mimeType,
					hash,
					componentId
				) VALUES (?, ?, ?, ?, ?)`, [
					uuid.v4(),
					project.location,
					'application/json',
					md5(file.elements),
					projectIds.get(project.pk_id)
				]
			);

			try {
				const file = await fs.readFile(`images/thumbnails/${project.location}`);
				const filename = uuid.v4();
				await conn.execute(`INSERT INTO logigator_new.component_preview_dark (
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
						projectIds.get(project.pk_id)
					]
				);
				await fs.writeFile(`resources/public/preview/dark/${filename}.png`, file);
			} catch (e) {
				if (e.code !== 'ENOENT')
					throw e;
			}
			await fs.writeFile(`resources/private/components/${project.location}.json`, JSON.stringify(file.elements));
		} else {
			await conn.execute(`INSERT INTO logigator_new.project (
					id,
					name,
					description,
					createdOn,
					lastEdited,
					link,
					public,
					userId,
					forkedFromId
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
					projectIds.get(project.pk_id),
					project.name,
					project.description,
					project.created_on,
					project.last_edited,
					uuid.v4(),
					false,
					userIds.get(project.fk_user),
					project.fk_originates_from ? projectIds.get(project.fk_originates_from) : null
				]
			);

			await conn.execute(`INSERT INTO logigator_new.project_file (
					id,
					filename,
					mimeType,
					hash,
					projectId
				) VALUES (?, ?, ?, ?, ?)`, [
					uuid.v4(),
					project.location,
					'application/json',
					md5(file.elements),
					projectIds.get(project.pk_id)
				]
			);

			try {
				const file = await fs.readFile(`images/thumbnails/${project.location}`);
				const filename = uuid.v4();
				await conn.execute(`INSERT INTO logigator_new.project_preview_dark (
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
						projectIds.get(project.pk_id)
					]
				);
				await fs.writeFile(`resources/public/preview/dark/${filename}.png`, file);
			} catch (e) {
				if (e.code !== 'ENOENT')
					throw e;
			}
			await fs.writeFile(`resources/private/projects/${project.location}.json`, JSON.stringify(file.elements));
		}
	}

	for (const project of projects[0]) {
		const file = JSON.parse(await fs.readFile(`projects/${project.location}`, 'utf8').catch(err => {
			if (err.code !== 'ENOENT')
				throw err;
			else
				return '{}';
		}));

		if (project.is_component[0] === 1) {
			for (const dep of file.mappings || []) {
				await conn.execute(`INSERT INTO logigator_new.component_dependency (
						model_id,
						dependentId,
						dependencyId
					) VALUES (?, ?, ?)`, [
						dep.model,
						projectIds.get(project.pk_id),
						projectIds.get(dep.database)
					]
				);
			}
		} else {
			for (const dep of file.mappings || []) {
				await conn.execute(`INSERT INTO logigator_new.project_dependency (
						model_id,
						dependentId,
						dependencyId
					) VALUES (?, ?, ?)`, [
						dep.model,
						projectIds.get(project.pk_id),
						projectIds.get(dep.database)
					]
				);
			}
		}
	}

	/**
	 * Shortcuts
	 */

	const shortcuts = await conn.execute('SELECT * FROM logigator_old.shortcuts');

	for (const shortcut of shortcuts[0]) {
		await conn.execute(`INSERT INTO logigator_new.shortcut (
				id,
				name,
				keyCode,
				shift,
				ctrl,
				alt,
				userId
			) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
				uuid.v4(),
				shortcut.name,
				shortcut.key_code,
				shortcut.shift[0] === 1,
				shortcut.ctrl[0] === 1,
				shortcut.alt[0] === 1,
				userIds.get(shortcut.fk_user)
			]
		);
	}


	await conn.destroy();
}

function convertElements(elements) {
	return elements.map(x => {
		const element = {
			c: x.id,
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
