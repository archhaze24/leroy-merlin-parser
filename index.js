import * as process from "node:process";
import puppeteer from "puppeteer";
import {PrismaClient} from "@prisma/client";
import 'dotenv/config'

async function getState(browser, url) {
    try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({'cookie': process.env.COOKIE});
        await page.goto(url);
        const state = page.evaluate('window.INITIAL_STATE');
        await page.close()
        return state
    } catch (err) {
        return err;
    }
}

async function parseCategoriesAndSaveInDb(browser, db, state) {
    const secondLevelCategories = [];

    for (const firstLevelCategory of state.catalogue.catalogue.catalogue.data) {
        if (firstLevelCategory.children === undefined) {
            continue
        }
        for (const secondLevelCategory of firstLevelCategory.children) {
            secondLevelCategories.push(secondLevelCategory.sitePath)
        }
    }

    for (const secondLevelCategory of secondLevelCategories) {
        console.log(secondLevelCategory)
        try {
            const state = await getState(browser, `https://lemanapro.ru${secondLevelCategory}`);

            for (const thirdLevelCategory of state.plp.plp.plp.catalogueStructure.catalogue) {
                await db.category.create({
                    data: {
                        name: thirdLevelCategory.name,
                        url: thirdLevelCategory.sitePath
                    }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }
}

const prisma = new PrismaClient();
const browser = await puppeteer.launch();
console.log('browser started')
console.log('checking for cookie')
const state = await getState(browser, "https://lemanapro.ru/catalogue/");
if (state === undefined) {
    console.error("cookie is bad or expired, update it!")
    process.exit(1);
}
console.log('all good, starting up!')

console.log('parsing categories')
console.log(state)
await parseCategoriesAndSaveInDb(browser, prisma, state);