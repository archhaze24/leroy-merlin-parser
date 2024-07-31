import { Page } from "puppeteer";
import getState from "./helpers/getState.js";
import parseCategoriesAndSaveInDb from "./parseCategories.js";
import parseProductsAndSaveInDb from "./parseProducts.js";
import parseStoresAndSaveInDb from "./parseStores.js";
import { PrismaClient } from "@prisma/client";
import logger from "../logger.js";

async function parse(page: Page, db: PrismaClient) {
  logger.info("parsing started");

  logger.info("parsing categories");
  const state = await getState(page, "https://lemanapro.ru/catalogue/");
  logger.info(state);
  await parseCategoriesAndSaveInDb(page, db, state);
  logger.info("done parsing categories");

  logger.info("parsing stores");
  await parseStoresAndSaveInDb(page, db);
  logger.info("done parsing stores");

  logger.info("parsing products");
  await parseProductsAndSaveInDb(page, db);
  logger.info("done parsing products");
}

export default parse;
