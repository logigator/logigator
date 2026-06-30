import {MigrationInterface, QueryRunner} from "typeorm";

export class AddNewFormatFlag1719662400000 implements MigrationInterface {
    name = 'AddNewFormatFlag1719662400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `project` ADD `newFormat` tinyint NOT NULL DEFAULT 0");
        await queryRunner.query("ALTER TABLE `component` ADD `newFormat` tinyint NOT NULL DEFAULT 0");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `component` DROP COLUMN `newFormat`");
        await queryRunner.query("ALTER TABLE `project` DROP COLUMN `newFormat`");
    }

}
