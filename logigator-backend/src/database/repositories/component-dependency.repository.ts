import {Service} from 'typedi';
import {EntityRepository, Repository} from 'typeorm';
import {ComponentDependency} from '../entities/component-dependency.entity';

@Service()
@EntityRepository(ComponentDependency)
export class ComponentDependencyRepository extends Repository<ComponentDependency> {

}
