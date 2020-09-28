import {TransformationType} from 'class-transformer/enums';

export function resolveEntityPromise(value: any, obj: any, transformationType: TransformationType, key: string) {
	return obj[`__${key}__`];
}
