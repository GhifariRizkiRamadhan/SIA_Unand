/*
  Warnings:

  - You are about to alter the column `date_out` on the `izinkeluar` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `date_return` on the `izinkeluar` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `izinkeluar` MODIFY `date_out` DATETIME NULL,
    MODIFY `date_return` DATETIME NULL;

-- AlterTable
ALTER TABLE `mahasiswa` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
