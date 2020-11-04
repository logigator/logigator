import {ProjectData} from './project-data';
import {ComponentData} from './component-data';

export interface Share extends ProjectData, ComponentData {
	type: 'project' | 'comp';
}
