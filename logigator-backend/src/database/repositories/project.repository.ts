import {EntityRepository, Repository} from "typeorm";
import {Service} from "typedi";
import {Project} from "../entities/project.entity";

@Service()
@EntityRepository(Project)
export class ProjectRepository extends Repository<Project> {

}
