-- AlterTable
ALTER TABLE `suratbebasasrama` MODIFY `detail_fasilitas` VARCHAR(100) NULL;

-- CreateTable
CREATE TABLE `KerusakanFasilitas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_fasilitas` VARCHAR(255) NOT NULL,
    `biaya_kerusakan` DECIMAL(12, 2) NOT NULL,
    `surat_id` INTEGER NOT NULL,

    INDEX `KerusakanFasilitas_surat_id_idx`(`surat_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KerusakanFasilitas` ADD CONSTRAINT `KerusakanFasilitas_surat_id_fkey` FOREIGN KEY (`surat_id`) REFERENCES `suratbebasasrama`(`Surat_id`) ON DELETE CASCADE ON UPDATE CASCADE;
