import {EntityRepository, Repository} from "typeorm";
import {Service} from "typedi";
import {Shortcut} from "../entities/shortcut.entity";

@Service()
@EntityRepository(Shortcut)
export class ShortcutRepository extends Repository<Shortcut> {

}
