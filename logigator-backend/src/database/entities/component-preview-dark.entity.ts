import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Component} from './component.entity';
import {Exclude} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ComponentPreviewDark extends PersistedResource {

	public mimeType = 'image/png';
	_cacheable = true;

	@OneToOne(type => Component, component => component.previewDark, {onDelete: 'CASCADE', onUpdate: 'CASCADE'})
	@JoinColumn()
	component: Promise<Component>

}
