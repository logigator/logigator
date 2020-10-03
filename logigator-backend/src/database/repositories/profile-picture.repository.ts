import {EntityRepository, Repository} from 'typeorm';
import {Service} from 'typedi';
import {ProfilePicture} from '../entities/profile-picture.entity';
import fetch from 'node-fetch';

@Service()
@EntityRepository(ProfilePicture)
export class ProfilePictureRepository extends Repository<ProfilePicture> {

	public async importFromUrl(url: string): Promise<ProfilePicture> {
		const resp = await fetch(url);
		const buffer = await resp.buffer();

		const resource = this.create();
		resource.setFileContent(buffer);
		resource.mimeType = resp.headers.get('content-type');

		return resource;
	}

	public async importFromUrlIfChanged(url: string, resourceToUpdate: ProfilePicture): Promise<ProfilePicture> {
		const resp = await fetch(url);
		const buffer = await resp.buffer();
		if (resourceToUpdate === null)
			resourceToUpdate = new ProfilePicture();
		resourceToUpdate.setFileContent(buffer);
		resourceToUpdate.mimeType = resp.headers.get('content-type');
		return resourceToUpdate;
	}

}
