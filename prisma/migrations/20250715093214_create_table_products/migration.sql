-- CreateTable
CREATE TABLE `products` (
    `idsku` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `title` VARCHAR(100) NOT NULL,
    `product_type` VARCHAR(15) NOT NULL,
    `IDCA` INTEGER NOT NULL,
    `IDCL` INTEGER NOT NULL,
    `id_partner` INTEGER NOT NULL,
    `id_printer` INTEGER NULL,
    `image` TEXT NULL,
    `measure` VARCHAR(3) NOT NULL,
    `quantity` DECIMAL(9, 3) NULL,
    `price` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `offer` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `description` VARCHAR(255) NULL,
    `remove` TEXT NULL,
    `include` TEXT NULL,
    `datasheet` TEXT NULL,

    PRIMARY KEY (`idsku`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
