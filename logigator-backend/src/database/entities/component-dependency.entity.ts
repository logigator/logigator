import {Column, Entity, ManyToMany, ManyToOne, PrimaryColumn} from 'typeorm';
import {Component} from './component.entity';
import {Exclude, Expose, Transform} from 'class-transformer';

@Entity()
export class ComponentDependency {
	@Exclude({toPlainOnly: true})
	@ManyToOne(type => Component, object => object.dependencies, {
		primary: true,
		eager: true,
		nullable: false,
		onDelete: 'CASCADE'
	})
	dependent: Component;

	@Transform((x: Component) => x.id, {toPlainOnly: true})
	@Expose({name: 'uuid', toPlainOnly: true})
	@ManyToOne(type => Component, object => object.dependencyForComponents, {
		primary: true,
		eager: true,
		nullable: false,
		onDelete: 'CASCADE'
	})
	dependency: Component;

	@Expose({name: 'model', toPlainOnly: true})
	@Column({nullable: false})
	model_id: number;
}
