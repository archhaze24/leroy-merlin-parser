import * as process from "node:process";
import puppeteer from "puppeteer-extra";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import * as child_process from "node:child_process";
import { join } from "path";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

async function getAndSetNewQratorKey(page) {
  let qrator_key = "";
  try {
    const pythonProcessPromise = new Promise((resolve, reject) => {
      const pythonProcess = child_process.spawn("python", [
        join(__dirname, "qrator_jsid.py"),
      ]);
      pythonProcess.stdout.on("data", (data) => {
        data = data.toString().trim();
        if (data.length !== 64) {
          reject("can't get qrator_jsid");
        }

        qrator_key = data;
        pythonProcess.kill();
        resolve(qrator_key);
      });
    });

    qrator_key = await pythonProcessPromise;
  } catch (e) {
    console.error(`${e}, retrying`);
  }

  console.log(`got new qrator_jsid: ${qrator_key}`);
  await page.setCookie({
    name: "qrator_jsid",
    value: qrator_key,
    url: "https://lemanapro.ru",
  });
}

async function getState(page, url) {
  try {
    await page.goto(url);
    return page.evaluate("window.INITIAL_STATE");
  } catch (err) {
    return undefined;
  }
}

async function parseCategoriesAndSaveInDb(page, db, state) {
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
    while (true) {
      console.log(`getting categories from route ${secondLevelCategory}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const state = await getState(
          page,
          `https://lemanapro.ru${secondLevelCategory}`
        );

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

        break;
      } catch (e) {
        console.error(
          `failed to get categories from route ${secondLevelCategory}, retrying: ${e}`
        );
      }
    }
  }
}

async function parseStoresAndSaveInDb(page, db) {
  let API_KEY = "";
  console.log("trying to get api key");
  while (true) {
    try {
      const state = await getState(
        page,
        `https://lemanapro.ru/product/drel-shurupovert-akkumulyatornaya-besshchetochnaya-rockfield-rf1002bk-89366403/`
      );
      if (state === undefined) {
        throw new Error("state fetching error, retrying");
      }

      API_KEY = state.pdp.pdp.env.API_KEY;
      console.log(`got api key: ${API_KEY}`);

      break;
    } catch (e) {
      console.error(`failed to get api key, retrying: ${e}`);
    }
  }

  console.log("trying to fetch stores");

  while (true) {
    try {
      const response = await fetch(
        `https://api.lemanapro.ru/experience/LeroymerlinWebsite/v1/navigation-pdp-api/get-regions-and-stores?x-api-key=${API_KEY}`,
        {
          method: "GET",
          headers: {
            Cookie: `qrator_jsid=${qrator_key}`,
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

async function parse(page, db) {
  console.log("parsing started");

  console.log("parsing categories");
  const state = await getState(page, "https://lemanapro.ru/catalogue/");
  await parseCategoriesAndSaveInDb(page, db, state);
  console.log("done parsing categories");

  console.log("parsing stores");
  await parseStoresAndSaveInDb(page, db);
  console.log("done parsing stores");
}

const prisma = new PrismaClient();
try {
  prisma.$connect();
} catch (e) {
  console.error(`failed to connect prisma client: ${e}`);
}
console.log("database is up");

puppeteer.use(StealthPlugin());
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 800 });
console.log("browser started");

await getAndSetNewQratorKey(page);
console.log("setting qrator_jsid to refresh every 4 minutes");
setInterval(() => getAndSetNewQratorKey(page), 4 * 60 * 1000);

console.log("setting parsing to run every 24 hours");
setInterval(() => parse(page, prisma), 24 * 60 * 60 * 1000);

parse(page, prisma);
