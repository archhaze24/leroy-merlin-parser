/*
  Warnings:

  - Added the required column `quantity` to the `StoreProduct` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "StoreProduct" ADD COLUMN     "quantity" INTEGER NOT NULL;
