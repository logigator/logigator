import {EntityRepository} from 'typeorm';
import {Service} from 'typedi';
import {Project} from '../entities/project.entity';
import {PageableRepository} from './pageable.repository';

@Service()
@EntityRepository(Project)
export class ProjectRepository extends PageableRepository<Project> {

}
