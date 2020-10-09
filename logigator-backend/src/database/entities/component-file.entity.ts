import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Component} from './component.entity';
import {Exclude} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ComponentFile extends PersistedResource {

	public mimeType = 'application/json';

	@Exclude()
	public get publicUrl() {
		return super.publicUrl;
	}

	@OneToOne(type => Component, component => component.elementsFile)
	@JoinColumn()
	component: Promise<Component>

}
