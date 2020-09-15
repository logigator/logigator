import {Service} from "typedi";
import {InjectRepository} from "typeorm-typedi-extensions";
import {UserRepository} from "../database/repositories/user.repository";

@Service()
export class AuthService {

	constructor(@InjectRepository() private userRepository: UserRepository) {}

}
