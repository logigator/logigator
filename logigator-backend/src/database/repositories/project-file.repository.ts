import {EntityRepository, Repository} from "typeorm";
import {Service} from "typedi";
import {ProjectFile} from "../entities/project-file.entity";

@Service()
@EntityRepository(ProjectFile)
export class ProjectFileRepository extends Repository<ProjectFile> {

}
