import {EntityRepository, Repository} from 'typeorm';
import {Service} from 'typedi';
import {Component} from '../entities/component.entity';

@Service()
@EntityRepository(Component)
export class ComponentRepository extends Repository<Component> {


}
