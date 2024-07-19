import {Column, Entity, ManyToOne} from 'typeorm';
import {Component} from './component.entity';
import {Project} from './project.entity';
import {Exclude, Expose, Transform} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ProjectDependency {
	@ManyToOne(() => Project, object => object.dependencies, {
		primary: true,
		eager: true,
		nullable: false,
		onDelete: 'CASCADE'
	})
	dependent: Project;

	@Expose()
	@Transform(({value}) => value.id, {groups: ['compactDependencies']})
	@ManyToOne(() => Component, object => object.dependencyForProjects, {
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
