import {InitService} from '../services/init/init.service';

export function initServices(init: InitService) {
	return () => {
		return init.initializeServiceData();
	};
}

