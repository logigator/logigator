import {Entity, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Component} from './component.entity';

@Entity()
export class ComponentFile extends PersistedResource {

	@OneToOne(type => Component, component => component.componentFile)
	component: Promise<Component>

}
