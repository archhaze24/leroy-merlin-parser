import { Page } from "puppeteer";
import getState from "./helpers/getState.js";
import { PrismaClient } from "@prisma/client";
import isIterable from "./helpers/isIterable.js";
import logger from "../logger.js";

async function parseCategoriesAndSaveInDb(
  page: Page,
  db: PrismaClient,
  state: any
) {
  const secondLevelCategories = [];

  for (const firstLevelCategory of state.catalogue.catalogue.catalogue.data) {
    if (firstLevelCategory.children === undefined) {
      continue;
    }
    for (const secondLevelCategory of firstLevelCategory.children) {
      secondLevelCategories.push(secondLevelCategory.sitePath);
    }
  }

  for (const secondLevelCategory of secondLevelCategories) {
    let notIterableInARow = 0;
    let undefinedInARow = 0;
    while (true) {
      logger.info(`getting categories from route ${secondLevelCategory}`);
      await new Promise((resolve) => setTimeout(resolve, 6000));
      try {
        const state = await getState(
          page,
          `https://lemanapro.ru${secondLevelCategory}`
        );
        if (state.plp === undefined) {
          undefinedInARow += 1;
          throw new Error("state is undefined");
        }
        if (!isIterable(state.plp.plp.plp.catalogueStructure.catalogue)) {
          notIterableInARow += 1;
          throw new Error("catalogue is not iterable");
        }

        for (const thirdLevelCategory of state.plp.plp.plp.catalogueStructure
          .catalogue) {
          await db.category.upsert({
            where: {
              url: thirdLevelCategory.sitePath,
            },
            update: {
              name: thirdLevelCategory.name,
            },
            create: {
              name: thirdLevelCategory.name,
              url: thirdLevelCategory.sitePath,
            },
          });
        }

        undefinedInARow = 0;
        notIterableInARow = 0;

        break;
      } catch (e) {
        console.error(
          `failed to get categories from route ${secondLevelCategory}, retrying: ${e}`
        );

        if (undefinedInARow === 6) {
          // todo: add proxy switching
          undefinedInARow = 0;
          break;
        }

        if (notIterableInARow === 6) {
          notIterableInARow = 0;
          break;
        }
      }
    }
  }
}

export default parseCategoriesAndSaveInDb;
