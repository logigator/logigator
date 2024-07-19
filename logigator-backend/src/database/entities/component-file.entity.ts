import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Component} from './component.entity';
import {Exclude} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ComponentFile extends PersistedResource {

	public mimeType = 'application/json';
	protected _path = 'private/components';

	@Exclude()
	public get publicUrl() {
		return super.publicUrl;
	}

	@OneToOne(() => Component, component => component.elementsFile, {onUpdate: 'CASCADE', onDelete: 'CASCADE'})
	@JoinColumn()
	component: Promise<Component>

}
