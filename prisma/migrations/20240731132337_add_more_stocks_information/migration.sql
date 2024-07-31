/*
  Warnings:

  - You are about to drop the column `quantity` on the `StoreProduct` table. All the data in the column will be lost.
  - Added the required column `stocks` to the `StoreProduct` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isAvailableOffline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isAvailableOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlineStocks" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StoreProduct" DROP COLUMN "quantity",
ADD COLUMN     "stocks" INTEGER NOT NULL;
