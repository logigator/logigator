import {EntityRepository, Repository} from 'typeorm';
import {Service} from 'typedi';
import {Link} from '../entities/link.entity';

@Service()
@EntityRepository(Link)
export class LinkRepository extends Repository<Link> {

}
