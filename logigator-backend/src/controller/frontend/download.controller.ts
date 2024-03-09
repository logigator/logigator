import {Controller, Get, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';
import fetch from 'node-fetch';
import {CachingService} from '../../services/caching.service';

@Controller('/download')
export class DownloadController {

	constructor(private cachingService: CachingService) {}

	@Get('/')
	@Render('download')
	@UseBefore(setTitleMiddleware('TITLE.DOWNLOAD'))
	public async index() {
		const data = await this.cachingService.get('electron_releases');

		if (!data) {
			return await this.refreshData();
		} else {
			this.cachingService.ttl('electron_releases').then(ttl => {
				if (ttl !== -1 && ttl < 60 * 60 * 23)
					this.refreshData();
			});
		}

		return JSON.parse(data);
	}

	private async refreshData() {
		try {
			const response = await (await fetch('https://api.github.com/repos/logigator/logigator/releases/62045403')).json();
			const assets = response.assets.map(x => {
				return {
					name: x.name,
					size: x.size,
					link: x.browser_download_url
				};
			});

			const releases = {
				date: response.published_at,
				version: response.tag_name,
				windows: assets.filter(x => x.name.includes('win32')),
				linux: assets.filter(x => x.name.includes('linux'))
			};

			this.cachingService.set('electron_releases', JSON.stringify(releases), 60 * 60 * 24).catch(e => console.error(e));
			return releases;
		} catch (e) {
			console.error(e);
		}
	}

}
