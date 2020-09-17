import {EntityRepository, Repository} from 'typeorm';
import {User} from '../entities/user.entity';
import {Service} from 'typedi';

@Service()
@EntityRepository(User)
export class UserRepository extends Repository<User> {

}
