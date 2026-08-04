import {MigrationInterface, QueryRunner} from "typeorm";

export class AddComponentVersion1784592000000 implements MigrationInterface {
    name = 'AddComponentVersion1784592000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `component` ADD `version` int NOT NULL DEFAULT 1");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `component` DROP COLUMN `version`");
    }

}
