-- CreateTable
CREATE TABLE `izinkeluar` (
    `izin_id` INTEGER NOT NULL AUTO_INCREMENT,
    `reason` VARCHAR(255) NOT NULL,
    `date_requested` DATE NOT NULL,
    `status` VARCHAR(50) NULL DEFAULT 'pending',
    `Pengelola_id` INTEGER NULL,
    `mahasiswa_id` INTEGER NOT NULL,

    INDEX `Pengelola_id`(`Pengelola_id`),
    INDEX `idx_izinkeluar_date`(`date_requested`),
    INDEX `mahasiswa_id`(`mahasiswa_id`),
    PRIMARY KEY (`izin_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mahasiswa` (
    `mahasiswa_id` INTEGER NOT NULL AUTO_INCREMENT,
    `nim` VARCHAR(50) NOT NULL,
    `nama` VARCHAR(50) NOT NULL,
    `status` VARCHAR(50) NULL DEFAULT 'aktif',
    `user_id` VARCHAR(50) NOT NULL,

    UNIQUE INDEX `nim`(`nim`),
    INDEX `idx_mahasiswa_nim`(`nim`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`mahasiswa_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pelaporankerusakan` (
    `laporan_id` INTEGER NOT NULL AUTO_INCREMENT,
    `description` VARCHAR(50) NOT NULL,
    `status` VARCHAR(50) NULL DEFAULT 'dilaporkan',
    `date_submitted` DATE NOT NULL,
    `mahasiswa_id` INTEGER NOT NULL,
    `Pengelola_id` INTEGER NULL,

    INDEX `Pengelola_id`(`Pengelola_id`),
    INDEX `idx_pelaporan_date`(`date_submitted`),
    INDEX `mahasiswa_id`(`mahasiswa_id`),
    PRIMARY KEY (`laporan_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pembayaran` (
    `pembayaran_id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(10, 2) NOT NULL,
    `payment_date` DATE NOT NULL,
    `status` VARCHAR(50) NULL DEFAULT 'pending',
    `mahasiswa_id` INTEGER NOT NULL,

    INDEX `idx_pembayaran_date`(`payment_date`),
    INDEX `mahasiswa_id`(`mahasiswa_id`),
    PRIMARY KEY (`pembayaran_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pemberitahuan` (
    `pemberitahuan_id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(50) NOT NULL,
    `content` VARCHAR(255) NOT NULL,
    `date` DATE NOT NULL,
    `Pengelola_id` INTEGER NOT NULL,
    `mahasiswa_id` INTEGER NULL,

    INDEX `Pengelola_id`(`Pengelola_id`),
    INDEX `idx_pemberitahuan_date`(`date`),
    INDEX `mahasiswa_id`(`mahasiswa_id`),
    PRIMARY KEY (`pemberitahuan_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pengelolaasrama` (
    `Pengelola_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(50) NOT NULL,

    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`Pengelola_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suratbebasasrama` (
    `Surat_id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` VARCHAR(50) NULL DEFAULT 'pending',
    `file` VARCHAR(50) NULL,
    `mahasiswa_id` INTEGER NOT NULL,
    `Pengelola_id` INTEGER NULL,

    INDEX `Pengelola_id`(`Pengelola_id`),
    INDEX `mahasiswa_id`(`mahasiswa_id`),
    PRIMARY KEY (`Surat_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `user_id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `email` VARCHAR(50) NOT NULL,
    `password` VARCHAR(50) NOT NULL,
    `role` VARCHAR(50) NOT NULL,

    UNIQUE INDEX `email`(`email`),
    INDEX `idx_user_email`(`email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `izinkeluar` ADD CONSTRAINT `izinkeluar_ibfk_1` FOREIGN KEY (`Pengelola_id`) REFERENCES `pengelolaasrama`(`Pengelola_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `izinkeluar` ADD CONSTRAINT `izinkeluar_ibfk_2` FOREIGN KEY (`mahasiswa_id`) REFERENCES `mahasiswa`(`mahasiswa_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mahasiswa` ADD CONSTRAINT `mahasiswa_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pelaporankerusakan` ADD CONSTRAINT `pelaporankerusakan_ibfk_1` FOREIGN KEY (`mahasiswa_id`) REFERENCES `mahasiswa`(`mahasiswa_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pelaporankerusakan` ADD CONSTRAINT `pelaporankerusakan_ibfk_2` FOREIGN KEY (`Pengelola_id`) REFERENCES `pengelolaasrama`(`Pengelola_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pembayaran` ADD CONSTRAINT `pembayaran_ibfk_1` FOREIGN KEY (`mahasiswa_id`) REFERENCES `mahasiswa`(`mahasiswa_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pemberitahuan` ADD CONSTRAINT `pemberitahuan_ibfk_1` FOREIGN KEY (`Pengelola_id`) REFERENCES `pengelolaasrama`(`Pengelola_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pemberitahuan` ADD CONSTRAINT `pemberitahuan_ibfk_2` FOREIGN KEY (`mahasiswa_id`) REFERENCES `mahasiswa`(`mahasiswa_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pengelolaasrama` ADD CONSTRAINT `pengelolaasrama_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suratbebasasrama` ADD CONSTRAINT `suratbebasasrama_ibfk_1` FOREIGN KEY (`mahasiswa_id`) REFERENCES `mahasiswa`(`mahasiswa_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suratbebasasrama` ADD CONSTRAINT `suratbebasasrama_ibfk_2` FOREIGN KEY (`Pengelola_id`) REFERENCES `pengelolaasrama`(`Pengelola_id`) ON DELETE SET NULL ON UPDATE CASCADE;
