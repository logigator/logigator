import {Column, Entity, ManyToOne, PrimaryColumn} from 'typeorm';
import {Component} from './component.entity';
import {Project} from './project.entity';
import {Exclude, Expose, Transform} from 'class-transformer';

@Entity()
export class ProjectDependency {
	@Exclude({toPlainOnly: true})
	@ManyToOne(type => Project, object => object.dependencies, {
		primary: true,
		eager: true,
		nullable: false,
		onDelete: 'CASCADE'
	})
	dependent: Project;

	@Transform((x: Component) => x.id, {toPlainOnly: true})
	@Expose({name: 'uuid', toPlainOnly: true})
	@ManyToOne(type => Component, object => object.dependencyForProjects, {
		primary: true,
		eager: true,
		nullable: false,
		onDelete: 'CASCADE'
	})
	dependency: Component;

	@Expose({name: 'model', toPlainOnly: true})
	@Column()
	model_id: number;
}
