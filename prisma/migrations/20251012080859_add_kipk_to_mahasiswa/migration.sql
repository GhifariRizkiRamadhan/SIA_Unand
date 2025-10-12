-- AlterTable
ALTER TABLE `izinkeluar` ADD COLUMN `date_approved` DATETIME(3) NULL,
    ADD COLUMN `date_out` DATETIME NULL,
    ADD COLUMN `date_return` DATETIME NULL,
    ADD COLUMN `document` VARCHAR(255) NULL,
    ADD COLUMN `notes` VARCHAR(255) NULL,
    ADD COLUMN `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `mahasiswa` ADD COLUMN `kipk` VARCHAR(10) NULL DEFAULT 'ya';

-- AlterTable
ALTER TABLE `pelaporankerusakan` ADD COLUMN `jenis` VARCHAR(100) NULL,
    ADD COLUMN `location` VARCHAR(255) NULL,
    ADD COLUMN `photo` VARCHAR(255) NULL,
    MODIFY `description` VARCHAR(255) NOT NULL,
    MODIFY `status` VARCHAR(50) NULL DEFAULT 'ditinjau',
    MODIFY `date_submitted` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `idx_izinkeluar_submitted_at` ON `izinkeluar`(`submitted_at`);

-- CreateIndex
CREATE INDEX `idx_izinkeluar_date_out` ON `izinkeluar`(`date_out`);

-- CreateIndex
CREATE INDEX `idx_izinkeluar_date_return` ON `izinkeluar`(`date_return`);
