-- CreateTable
CREATE TABLE `notification` (
    `notification_id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` VARCHAR(50) NOT NULL,
    `reference_id` VARCHAR(191) NULL,

    INDEX `notification_user_id_idx`(`user_id`),
    INDEX `notification_created_at_idx`(`created_at`),
    INDEX `notification_is_read_idx`(`is_read`),
    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
