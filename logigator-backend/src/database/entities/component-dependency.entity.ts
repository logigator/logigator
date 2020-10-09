import {Column, Entity, ManyToOne} from 'typeorm';
import {Component} from './component.entity';
import {Exclude, Expose, Transform} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ComponentDependency {
	@ManyToOne(type => Component, object => object.dependencies, {
		primary: true,
		eager: true,
		nullable: false,
		onDelete: 'CASCADE'
	})
	dependent: Component;

	@Expose()
	@Transform((x: Component) => x.id, {groups: ['compactDependencies']})
	@ManyToOne(type => Component, object => object.dependencyForComponents, {
		primary: true,
		eager: true,
		nullable: false,
		onDelete: 'CASCADE'
	})
	dependency: Component;

	@Expose({name: 'model'})
	@Column({nullable: false})
	model_id: number;
}
