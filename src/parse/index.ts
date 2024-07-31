import { Page } from "puppeteer";
import getState from "./helpers/getState.js";
import parseCategoriesAndSaveInDb from "./parseCategories.js";
import parseProductsAndSaveInDb from "./parseProducts.js";
import parseStoresAndSaveInDb from "./parseStores.js";
import { PrismaClient } from "@prisma/client";

async function parse(page: Page, db: PrismaClient) {
  console.log("parsing started");

  console.log("parsing categories");
  const state = await getState(page, "https://lemanapro.ru/catalogue/");
  console.log(state);
  await parseCategoriesAndSaveInDb(page, db, state);
  console.log("done parsing categories");

  console.log("parsing stores");
  await parseStoresAndSaveInDb(page, db);
  console.log("done parsing stores");

  console.log("parsing products");
  await parseProductsAndSaveInDb(page, db);
  console.log("done parsing products");
}

export default parse;
