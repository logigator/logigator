import {ComponentInspectable} from './graphics/l-graphics';

export interface ReqInspectElementEvent {
	identifier: string;
	sprite?: ComponentInspectable;
	typeId: number;
	parentNames: string[];
	parentTypeIds: number[];
}
