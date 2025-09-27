/*
  Warnings:

  - You are about to alter the column `user_id` on the `mahasiswa` table. The data in that column could be lost. The data in that column will be cast from `VarChar(50)` to `Int`.
  - You are about to alter the column `user_id` on the `pengelolaasrama` table. The data in that column could be lost. The data in that column will be cast from `VarChar(50)` to `Int`.
  - The primary key for the `user` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `user_id` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(50)` to `Int`.

*/
-- DropForeignKey
ALTER TABLE `mahasiswa` DROP FOREIGN KEY `mahasiswa_ibfk_1`;

-- DropForeignKey
ALTER TABLE `pengelolaasrama` DROP FOREIGN KEY `pengelolaasrama_ibfk_1`;

-- AlterTable
ALTER TABLE `mahasiswa` MODIFY `user_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `pengelolaasrama` MODIFY `user_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `user` DROP PRIMARY KEY,
    MODIFY `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`user_id`);

-- AddForeignKey
ALTER TABLE `mahasiswa` ADD CONSTRAINT `mahasiswa_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pengelolaasrama` ADD CONSTRAINT `pengelolaasrama_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
