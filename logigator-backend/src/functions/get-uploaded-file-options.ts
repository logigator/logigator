import {Options, memoryStorage} from 'multer';

export function getUploadedFileOptions(files = 1): Options {
	return {
		storage: memoryStorage(),
		limits: {
			files,
			fileSize: 1048576
		}
	};
}
