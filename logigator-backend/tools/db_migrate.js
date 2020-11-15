const mysql2 = require('mysql2/promise');
const uuid = require('uuid');

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
	await conn.execute('DELETE FROM logigator_new.project_dependency');
	await conn.execute('DELETE FROM logigator_new.component_file');
	await conn.execute('DELETE FROM logigator_new.project_file');
	await conn.execute('DELETE FROM logigator_new.shortcut');
	await conn.execute('SET FOREIGN_KEY_CHECKS=1');

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
		]);
		if (u.profile_image) {
			await conn.execute(`INSERT INTO logigator_new.profile_picture (id, filename, mimeType, hash, userId)
			                    VALUES (?, ?, ?, ?, ?)`,
				[
					uuid.v4(),
					u.profile_image,
					'image/jpeg',
					'00000000000000000000000000000000',
					id
				]
			)
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
			]);
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
			]);
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
		]);
	}


	await conn.destroy();
}
