import {EntityRepository} from 'typeorm';
import {Service} from 'typedi';
import {Component} from '../entities/component.entity';
import {PageableRepository} from './pageable.repository';

@Service()
@EntityRepository(Component)
export class ComponentRepository extends PageableRepository<Component> {


}
