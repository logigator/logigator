import {MigrationInterface, QueryRunner} from "typeorm";

export class Inital1610214552329 implements MigrationInterface {
    name = 'Inital1610214552329'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("CREATE TABLE `shortcut` (`id` varchar(36) NOT NULL, `name` varchar(255) NOT NULL, `keyCode` varchar(255) NOT NULL, `shift` tinyint NOT NULL DEFAULT 0, `ctrl` tinyint NOT NULL DEFAULT 0, `alt` tinyint NOT NULL DEFAULT 0, `userId` varchar(36) NOT NULL, UNIQUE INDEX `IDX_14df8c7c1eb2a9dd9ce77e5f77` (`name`, `userId`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `project_file` (`id` varchar(36) NOT NULL, `filename` varchar(36) NOT NULL, `mimeType` varchar(255) NOT NULL, `hash` char(32) NOT NULL DEFAULT '00000000000000000000000000000000', `projectId` varchar(36) NULL, UNIQUE INDEX `IDX_460159b0be55c3a397dc9b42cb` (`filename`), UNIQUE INDEX `REL_f8b1098952dc5f55a00ee0c1f3` (`projectId`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `project_dependency` (`model_id` int NOT NULL, `dependentId` varchar(36) NOT NULL, `dependencyId` varchar(36) NOT NULL, PRIMARY KEY (`dependentId`, `dependencyId`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `project_preview_dark` (`id` varchar(36) NOT NULL, `filename` varchar(36) NOT NULL, `mimeType` varchar(255) NOT NULL, `hash` char(32) NOT NULL DEFAULT '00000000000000000000000000000000', `projectId` varchar(36) NULL, UNIQUE INDEX `IDX_dee5a5e2f33ed40a1ae3b90fa5` (`filename`), UNIQUE INDEX `REL_937487efe30e8e45613c6996fb` (`projectId`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `project_preview_light` (`id` varchar(36) NOT NULL, `filename` varchar(36) NOT NULL, `mimeType` varchar(255) NOT NULL, `hash` char(32) NOT NULL DEFAULT '00000000000000000000000000000000', `projectId` varchar(36) NULL, UNIQUE INDEX `IDX_4f58d56cb71694b7457614836c` (`filename`), UNIQUE INDEX `REL_a7ff9f165a68ce68cf7402a235` (`projectId`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `project` (`id` varchar(36) NOT NULL, `name` varchar(20) NOT NULL, `description` varchar(2048) NOT NULL DEFAULT '', `createdOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `lastEdited` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `link` varchar(36) NOT NULL, `public` tinyint NOT NULL DEFAULT 0, `userId` varchar(36) NOT NULL, `forkedFromId` varchar(36) NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `profile_picture` (`id` varchar(36) NOT NULL, `filename` varchar(36) NOT NULL, `mimeType` varchar(255) NOT NULL, `hash` char(32) NOT NULL DEFAULT '00000000000000000000000000000000', `userId` varchar(36) NULL, UNIQUE INDEX `IDX_934fa4cdf0e61f1da82cb20afa` (`filename`), UNIQUE INDEX `REL_ab4229950292cb6e896d012dac` (`userId`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `component_file` (`id` varchar(36) NOT NULL, `filename` varchar(36) NOT NULL, `mimeType` varchar(255) NOT NULL, `hash` char(32) NOT NULL DEFAULT '00000000000000000000000000000000', `componentId` varchar(36) NULL, UNIQUE INDEX `IDX_30e28a63720386b9dd4d31ba3f` (`filename`), UNIQUE INDEX `REL_485efc9ca5b727d0b4d8a52ebb` (`componentId`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `user` (`id` varchar(36) NOT NULL, `memberSince` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `username` varchar(255) NOT NULL, `email` varchar(255) NOT NULL, `password` varchar(255) NULL, `googleUserId` varchar(255) NULL, `twitterUserId` varchar(255) NULL, `localEmailVerified` tinyint NOT NULL DEFAULT 1, UNIQUE INDEX `IDX_e12875dfb3b1d92d7d7c5377e2` (`email`), UNIQUE INDEX `IDX_3a6d6e65d5678fd41783302bbb` (`googleUserId`), UNIQUE INDEX `IDX_65f871dfc30cb4d167fff3d12e` (`twitterUserId`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `component_preview_dark` (`id` varchar(36) NOT NULL, `filename` varchar(36) NOT NULL, `mimeType` varchar(255) NOT NULL, `hash` char(32) NOT NULL DEFAULT '00000000000000000000000000000000', `componentId` varchar(36) NULL, UNIQUE INDEX `IDX_2a7a01d3d515558ac50d0d3c41` (`filename`), UNIQUE INDEX `REL_63c0cee830061567ea7b82a3fe` (`componentId`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `component_preview_light` (`id` varchar(36) NOT NULL, `filename` varchar(36) NOT NULL, `mimeType` varchar(255) NOT NULL, `hash` char(32) NOT NULL DEFAULT '00000000000000000000000000000000', `componentId` varchar(36) NULL, UNIQUE INDEX `IDX_b4d20b1406ae68d27fb560f6d1` (`filename`), UNIQUE INDEX `REL_6c396a180794d4df932e083223` (`componentId`), PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `component` (`id` varchar(36) NOT NULL, `name` varchar(20) NOT NULL, `description` varchar(2048) NOT NULL DEFAULT '', `createdOn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `lastEdited` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `symbol` varchar(5) NOT NULL, `numInputs` int NOT NULL DEFAULT '0', `numOutputs` int NOT NULL DEFAULT '0', `labels` text NOT NULL, `link` varchar(36) NOT NULL, `public` tinyint NOT NULL DEFAULT 0, `userId` varchar(36) NOT NULL, `forkedFromId` varchar(36) NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `component_dependency` (`model_id` int NOT NULL, `dependentId` varchar(36) NOT NULL, `dependencyId` varchar(36) NOT NULL, PRIMARY KEY (`dependentId`, `dependencyId`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `project_stargazers_user` (`projectId` varchar(36) NOT NULL, `userId` varchar(36) NOT NULL, INDEX `IDX_0057125f410b5a08a22e9458b0` (`projectId`), INDEX `IDX_3ff0d89ef57e07c0a083a355d9` (`userId`), PRIMARY KEY (`projectId`, `userId`)) ENGINE=InnoDB");
        await queryRunner.query("CREATE TABLE `component_stargazers_user` (`componentId` varchar(36) NOT NULL, `userId` varchar(36) NOT NULL, INDEX `IDX_282c210f7731433947b35d645e` (`componentId`), INDEX `IDX_02bac42c426c92bd6a1b641aed` (`userId`), PRIMARY KEY (`componentId`, `userId`)) ENGINE=InnoDB");
        await queryRunner.query("ALTER TABLE `shortcut` ADD CONSTRAINT `FK_6c339317f44b0f6788634b1dec1` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
        await queryRunner.query("ALTER TABLE `project_file` ADD CONSTRAINT `FK_f8b1098952dc5f55a00ee0c1f39` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
        await queryRunner.query("ALTER TABLE `project_dependency` ADD CONSTRAINT `FK_619b72b6003ee637d131a05f6d8` FOREIGN KEY (`dependentId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `project_dependency` ADD CONSTRAINT `FK_67ed36e8ee275a9c2cf2f360027` FOREIGN KEY (`dependencyId`) REFERENCES `component`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `project_preview_dark` ADD CONSTRAINT `FK_937487efe30e8e45613c6996fb0` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
        await queryRunner.query("ALTER TABLE `project_preview_light` ADD CONSTRAINT `FK_a7ff9f165a68ce68cf7402a2357` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
        await queryRunner.query("ALTER TABLE `project` ADD CONSTRAINT `FK_7c4b0d3b77eaf26f8b4da879e63` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
        await queryRunner.query("ALTER TABLE `project` ADD CONSTRAINT `FK_2a2b2dc47eed8ab752987f50d9a` FOREIGN KEY (`forkedFromId`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `profile_picture` ADD CONSTRAINT `FK_ab4229950292cb6e896d012dac8` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
        await queryRunner.query("ALTER TABLE `component_file` ADD CONSTRAINT `FK_485efc9ca5b727d0b4d8a52ebbc` FOREIGN KEY (`componentId`) REFERENCES `component`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
        await queryRunner.query("ALTER TABLE `component_preview_dark` ADD CONSTRAINT `FK_63c0cee830061567ea7b82a3fef` FOREIGN KEY (`componentId`) REFERENCES `component`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
        await queryRunner.query("ALTER TABLE `component_preview_light` ADD CONSTRAINT `FK_6c396a180794d4df932e0832231` FOREIGN KEY (`componentId`) REFERENCES `component`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
        await queryRunner.query("ALTER TABLE `component` ADD CONSTRAINT `FK_27a15241df08397ea1328de3263` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE");
        await queryRunner.query("ALTER TABLE `component` ADD CONSTRAINT `FK_e27f505aca7f25173e3f2d67c09` FOREIGN KEY (`forkedFromId`) REFERENCES `component`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `component_dependency` ADD CONSTRAINT `FK_6fa69dc0b06b392b5cb7098fc63` FOREIGN KEY (`dependentId`) REFERENCES `component`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `component_dependency` ADD CONSTRAINT `FK_90ee26af2b5e0c31a66b90878f2` FOREIGN KEY (`dependencyId`) REFERENCES `component`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `project_stargazers_user` ADD CONSTRAINT `FK_0057125f410b5a08a22e9458b00` FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `project_stargazers_user` ADD CONSTRAINT `FK_3ff0d89ef57e07c0a083a355d94` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `component_stargazers_user` ADD CONSTRAINT `FK_282c210f7731433947b35d645e3` FOREIGN KEY (`componentId`) REFERENCES `component`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION");
        await queryRunner.query("ALTER TABLE `component_stargazers_user` ADD CONSTRAINT `FK_02bac42c426c92bd6a1b641aed5` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `component_stargazers_user` DROP FOREIGN KEY `FK_02bac42c426c92bd6a1b641aed5`");
        await queryRunner.query("ALTER TABLE `component_stargazers_user` DROP FOREIGN KEY `FK_282c210f7731433947b35d645e3`");
        await queryRunner.query("ALTER TABLE `project_stargazers_user` DROP FOREIGN KEY `FK_3ff0d89ef57e07c0a083a355d94`");
        await queryRunner.query("ALTER TABLE `project_stargazers_user` DROP FOREIGN KEY `FK_0057125f410b5a08a22e9458b00`");
        await queryRunner.query("ALTER TABLE `component_dependency` DROP FOREIGN KEY `FK_90ee26af2b5e0c31a66b90878f2`");
        await queryRunner.query("ALTER TABLE `component_dependency` DROP FOREIGN KEY `FK_6fa69dc0b06b392b5cb7098fc63`");
        await queryRunner.query("ALTER TABLE `component` DROP FOREIGN KEY `FK_e27f505aca7f25173e3f2d67c09`");
        await queryRunner.query("ALTER TABLE `component` DROP FOREIGN KEY `FK_27a15241df08397ea1328de3263`");
        await queryRunner.query("ALTER TABLE `component_preview_light` DROP FOREIGN KEY `FK_6c396a180794d4df932e0832231`");
        await queryRunner.query("ALTER TABLE `component_preview_dark` DROP FOREIGN KEY `FK_63c0cee830061567ea7b82a3fef`");
        await queryRunner.query("ALTER TABLE `component_file` DROP FOREIGN KEY `FK_485efc9ca5b727d0b4d8a52ebbc`");
        await queryRunner.query("ALTER TABLE `profile_picture` DROP FOREIGN KEY `FK_ab4229950292cb6e896d012dac8`");
        await queryRunner.query("ALTER TABLE `project` DROP FOREIGN KEY `FK_2a2b2dc47eed8ab752987f50d9a`");
        await queryRunner.query("ALTER TABLE `project` DROP FOREIGN KEY `FK_7c4b0d3b77eaf26f8b4da879e63`");
        await queryRunner.query("ALTER TABLE `project_preview_light` DROP FOREIGN KEY `FK_a7ff9f165a68ce68cf7402a2357`");
        await queryRunner.query("ALTER TABLE `project_preview_dark` DROP FOREIGN KEY `FK_937487efe30e8e45613c6996fb0`");
        await queryRunner.query("ALTER TABLE `project_dependency` DROP FOREIGN KEY `FK_67ed36e8ee275a9c2cf2f360027`");
        await queryRunner.query("ALTER TABLE `project_dependency` DROP FOREIGN KEY `FK_619b72b6003ee637d131a05f6d8`");
        await queryRunner.query("ALTER TABLE `project_file` DROP FOREIGN KEY `FK_f8b1098952dc5f55a00ee0c1f39`");
        await queryRunner.query("ALTER TABLE `shortcut` DROP FOREIGN KEY `FK_6c339317f44b0f6788634b1dec1`");
        await queryRunner.query("DROP INDEX `IDX_02bac42c426c92bd6a1b641aed` ON `component_stargazers_user`");
        await queryRunner.query("DROP INDEX `IDX_282c210f7731433947b35d645e` ON `component_stargazers_user`");
        await queryRunner.query("DROP TABLE `component_stargazers_user`");
        await queryRunner.query("DROP INDEX `IDX_3ff0d89ef57e07c0a083a355d9` ON `project_stargazers_user`");
        await queryRunner.query("DROP INDEX `IDX_0057125f410b5a08a22e9458b0` ON `project_stargazers_user`");
        await queryRunner.query("DROP TABLE `project_stargazers_user`");
        await queryRunner.query("DROP TABLE `component_dependency`");
        await queryRunner.query("DROP TABLE `component`");
        await queryRunner.query("DROP INDEX `REL_6c396a180794d4df932e083223` ON `component_preview_light`");
        await queryRunner.query("DROP INDEX `IDX_b4d20b1406ae68d27fb560f6d1` ON `component_preview_light`");
        await queryRunner.query("DROP TABLE `component_preview_light`");
        await queryRunner.query("DROP INDEX `REL_63c0cee830061567ea7b82a3fe` ON `component_preview_dark`");
        await queryRunner.query("DROP INDEX `IDX_2a7a01d3d515558ac50d0d3c41` ON `component_preview_dark`");
        await queryRunner.query("DROP TABLE `component_preview_dark`");
        await queryRunner.query("DROP INDEX `IDX_65f871dfc30cb4d167fff3d12e` ON `user`");
        await queryRunner.query("DROP INDEX `IDX_3a6d6e65d5678fd41783302bbb` ON `user`");
        await queryRunner.query("DROP INDEX `IDX_e12875dfb3b1d92d7d7c5377e2` ON `user`");
        await queryRunner.query("DROP TABLE `user`");
        await queryRunner.query("DROP INDEX `REL_485efc9ca5b727d0b4d8a52ebb` ON `component_file`");
        await queryRunner.query("DROP INDEX `IDX_30e28a63720386b9dd4d31ba3f` ON `component_file`");
        await queryRunner.query("DROP TABLE `component_file`");
        await queryRunner.query("DROP INDEX `REL_ab4229950292cb6e896d012dac` ON `profile_picture`");
        await queryRunner.query("DROP INDEX `IDX_934fa4cdf0e61f1da82cb20afa` ON `profile_picture`");
        await queryRunner.query("DROP TABLE `profile_picture`");
        await queryRunner.query("DROP TABLE `project`");
        await queryRunner.query("DROP INDEX `REL_a7ff9f165a68ce68cf7402a235` ON `project_preview_light`");
        await queryRunner.query("DROP INDEX `IDX_4f58d56cb71694b7457614836c` ON `project_preview_light`");
        await queryRunner.query("DROP TABLE `project_preview_light`");
        await queryRunner.query("DROP INDEX `REL_937487efe30e8e45613c6996fb` ON `project_preview_dark`");
        await queryRunner.query("DROP INDEX `IDX_dee5a5e2f33ed40a1ae3b90fa5` ON `project_preview_dark`");
        await queryRunner.query("DROP TABLE `project_preview_dark`");
        await queryRunner.query("DROP TABLE `project_dependency`");
        await queryRunner.query("DROP INDEX `REL_f8b1098952dc5f55a00ee0c1f3` ON `project_file`");
        await queryRunner.query("DROP INDEX `IDX_460159b0be55c3a397dc9b42cb` ON `project_file`");
        await queryRunner.query("DROP TABLE `project_file`");
        await queryRunner.query("DROP INDEX `IDX_14df8c7c1eb2a9dd9ce77e5f77` ON `shortcut`");
        await queryRunner.query("DROP TABLE `shortcut`");
    }

}
