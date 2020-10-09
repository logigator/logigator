import {Column, Entity, ManyToOne} from 'typeorm';
import {Component} from './component.entity';
import {Project} from './project.entity';
import {Exclude, Expose, Transform} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ProjectDependency {
	@ManyToOne(type => Project, object => object.dependencies, {
		primary: true,
		eager: true,
		nullable: false,
		onDelete: 'CASCADE'
	})
	dependent: Project;

	@Expose()
	@Transform((x: Component) => x.id, {groups: ['compactDependencies']})
	@ManyToOne(type => Component, object => object.dependencyForProjects, {
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
