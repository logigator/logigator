import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Component} from './component.entity';
import {Exclude} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ComponentPreviewLight extends PersistedResource {

	public mimeType = 'image/png';
	protected _path = 'public/preview/light';
	protected _cacheable = true;

	@OneToOne(() => Component, component => component.previewLight, {onUpdate: 'CASCADE', onDelete: 'CASCADE'})
	@JoinColumn()
	component: Promise<Component>

}
