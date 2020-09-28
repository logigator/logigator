import {Service} from 'typedi';
import {EntityRepository, Repository} from 'typeorm';
import {ProjectDependency} from '../entities/project-dependency.entity';

@Service()
@EntityRepository(ProjectDependency)
export class ProjectDependencyRepository extends Repository<ProjectDependency> {

}
