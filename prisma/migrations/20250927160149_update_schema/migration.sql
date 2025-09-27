/*
  Warnings:

  - You are about to drop the column `status` on the `pembayaran` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `pembayaran` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(12,2)`.
  - You are about to drop the column `mahasiswa_id` on the `pemberitahuan` table. All the data in the column will be lost.
  - You are about to alter the column `content` on the `pemberitahuan` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to drop the column `file` on the `suratbebasasrama` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `suratbebasasrama` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nomor_pengajuan]` on the table `suratbebasasrama` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `surat_id` to the `pembayaran` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nomor_pengajuan` to the `suratbebasasrama` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_biaya` to the `suratbebasasrama` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `pemberitahuan` DROP FOREIGN KEY `pemberitahuan_ibfk_1`;

-- DropForeignKey
ALTER TABLE `pemberitahuan` DROP FOREIGN KEY `pemberitahuan_ibfk_2`;

-- DropIndex
DROP INDEX `mahasiswa_id` ON `pemberitahuan`;

-- AlterTable
ALTER TABLE `pembayaran` DROP COLUMN `status`,
    ADD COLUMN `bukti_pembayaran` VARCHAR(255) NULL,
    ADD COLUMN `status_bukti` ENUM('BELUM_DIVERIFIKASI', 'VALID', 'TIDAK_VALID') NOT NULL DEFAULT 'BELUM_DIVERIFIKASI',
    ADD COLUMN `surat_id` INTEGER NOT NULL,
    MODIFY `amount` DECIMAL(12, 2) NOT NULL,
    MODIFY `payment_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `pemberitahuan` DROP COLUMN `mahasiswa_id`,
    ADD COLUMN `image` VARCHAR(191) NULL,
    MODIFY `title` VARCHAR(191) NOT NULL,
    MODIFY `content` VARCHAR(191) NOT NULL,
    MODIFY `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `suratbebasasrama` DROP COLUMN `file`,
    DROP COLUMN `status`,
    ADD COLUMN `biaya_tambahan` DECIMAL(12, 2) NULL,
    ADD COLUMN `detail_fasilitas` TEXT NULL,
    ADD COLUMN `fasilitas_status` VARCHAR(100) NULL,
    ADD COLUMN `nomor_pengajuan` VARCHAR(50) NOT NULL,
    ADD COLUMN `status_pengajuan` ENUM('VERIFIKASI_FASILITAS', 'MENUNGGU_PEMBAYARAN', 'VERIFIKASI_PEMBAYARAN', 'SELESAI') NOT NULL DEFAULT 'VERIFIKASI_FASILITAS',
    ADD COLUMN `tanggal_pengajuan` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `tanggal_update` DATETIME(3) NULL,
    ADD COLUMN `total_biaya` DECIMAL(12, 2) NOT NULL;

-- CreateIndex
CREATE INDEX `surat_id` ON `pembayaran`(`surat_id`);

-- CreateIndex
CREATE UNIQUE INDEX `suratbebasasrama_nomor_pengajuan_key` ON `suratbebasasrama`(`nomor_pengajuan`);

-- CreateIndex
CREATE INDEX `idx_surat_tanggal` ON `suratbebasasrama`(`tanggal_pengajuan`);

-- AddForeignKey
ALTER TABLE `pembayaran` ADD CONSTRAINT `pembayaran_ibfk_2` FOREIGN KEY (`surat_id`) REFERENCES `suratbebasasrama`(`Surat_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pemberitahuan` ADD CONSTRAINT `pemberitahuan_Pengelola_id_fkey` FOREIGN KEY (`Pengelola_id`) REFERENCES `pengelolaasrama`(`Pengelola_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
