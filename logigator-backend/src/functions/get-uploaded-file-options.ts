import {Options, memoryStorage} from 'multer';

export function getUploadedFileOptions(): Options {
	return {
		storage: memoryStorage(),
		limits: {
			files: 1,
			fileSize: 1048576
		}
	};
}
