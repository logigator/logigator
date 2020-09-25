import {EntityRepository, Repository} from 'typeorm';
import {Service} from 'typedi';
import {ComponentFile} from '../entities/component-file.entity';

@Service()
@EntityRepository(ComponentFile)
export class ComponentFileRepository extends Repository<ComponentFile> {

}
