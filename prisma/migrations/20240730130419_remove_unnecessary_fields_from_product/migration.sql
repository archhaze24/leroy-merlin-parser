/*
  Warnings:

  - You are about to drop the column `availableInStoreIds` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "availableInStoreIds",
DROP COLUMN "quantity";