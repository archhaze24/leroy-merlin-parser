import { PrismaClient } from "@prisma/client";
import { Page } from "puppeteer";
import api from "../constants/api.js";
import qrator from "../constants/qrator.js";
import getState from "./helpers/getState.js";
import logger from "../logger.js";

async function parseStoresAndSaveInDb(page: Page, db: PrismaClient) {
  logger.info("trying to get api key");
  while (true) {
    try {
      const state = await getState(
        page,
        `https://lemanapro.ru/product/drel-shurupovert-akkumulyatornaya-besshchetochnaya-rockfield-rf1002bk-89366403/`
      );
      if (state === undefined) {
        throw new Error("state fetching error, retrying");
      }

      api.key = state.pdp.pdp.env.API_KEY;
      logger.info(`got api key: ${api.key}`);

      break;
    } catch (e) {
      console.error(`failed to get api key, retrying: ${e}`);
    }
  }

  logger.info("trying to fetch stores");

  while (true) {
    try {
      const response = await fetch(
        `https://api.lemanapro.ru/experience/LeroymerlinWebsite/v1/navigation-pdp-api/get-regions-and-stores?x-api-key=${api.key}`,
        {
          method: "GET",
          headers: {
            Cookie: `qrator_jsid=${qrator.jsid}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error(`status code ${response.status}`);
      }
      const json = await response.json();

      for (const store of json.availabledStores) {
        if (store.regionId === "34") {
          await db.store.upsert({
            where: { id: parseInt(store.id) },
            create: { name: store.title, id: parseInt(store.id) },
            update: { name: store.title },
          });
        }
      }

      break;
    } catch (e) {
      console.error(`failed to fetch stores, retrying: ${e}`);
    }
  }
}

export default parseStoresAndSaveInDb;
