import {Entity, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Component} from './component.entity';
import {Exclude} from 'class-transformer';

@Entity()
export class ComponentFile extends PersistedResource {

	@Exclude()
	public get publicUrl() {
		return super.publicUrl;
	}

	@OneToOne(type => Component, component => component.componentFile)
	component: Promise<Component>

}
