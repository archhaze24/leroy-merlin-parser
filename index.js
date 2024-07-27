import * as process from "node:process";
import puppeteer from "puppeteer";
import {PrismaClient} from "@prisma/client";
import 'dotenv/config'

async function getState(page, url) {
    try {
        await page.goto(url);
        return page.evaluate('window.INITIAL_STATE')
    } catch (err) {
        return undefined;
    }
}

async function parseCategoriesAndSaveInDb(page, db, state) {
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
        while (true) {
            console.log('getting categories from route, ' + secondLevelCategory)
            try {
                const state = await getState(page, `https://lemanapro.ru${secondLevelCategory}`);

                for (const thirdLevelCategory of state.plp.plp.plp.catalogueStructure.catalogue) {
                    await db.category.create({
                        data: {
                            name: thirdLevelCategory.name,
                            url: thirdLevelCategory.sitePath
                        }
                    });
                }

                break;
            } catch (e) {
                console.error(e);
                console.error('retrying to get categories for route ' + secondLevelCategory)
            }
        }
    }
}

async function parseStoresAndSaveInDb(page, db) {
    let API_KEY = 'nkGKLkscp80GVAQVY8YvajPjzaFTmIS8';
    console.log('trying to get api key')
    while (true) {
        try {
            // const state = await getState(page, `https://lemanapro.ru/product/drel-shurupovert-akkumulyatornaya-besshchetochnaya-rockfield-rf1002bk-89366403/`);
            // if (state === undefined) {
            //     throw new Error('state fetching error: state died')
            // }
            //
            // API_KEY = state.pdp.pdp.env.API_KEY;
            // console.log('got api key: ' + API_KEY)
            //
            break
        } catch (e) {
            console.error(e);
            console.error('retrying to get api key');
        }
    }

    console.log('trying to fetch stores')

    while (true) {
        try {
            const response = await fetch(`https://api.lemanapro.ru/experience/LeroymerlinWebsite/v1/navigation-pdp-api/get-regions-and-stores?x-api-key=${API_KEY}`, {
                method: 'GET',
                headers: {
                    'Cookie': '_frt_=03684b824c41d5692fdd278e340a0d95; _regionID=34; daysToHide=14; loadLmCookie=true; uid_experiment=687e0c979f53a84e5167fa3f62a56f85; pageExperiments=pdp_complements_super_duper:B; cookie_accepted=true; qrator_jsr=1722102507.331.9dXxaXwgM0Qd9Fev-rgkqo7t98kn9njvfvp5mg7n0fnor50kj-00; qrator_jsid=1722102507.331.9dXxaXwgM0Qd9Fev-hc9bk9h8vnnlr3v13k5o33pdj0mteuk7'
                }
            })
            if (!response.ok) {
                throw new Error('fetch stores failed with status code ' + response.status)
            }
            const json = await response.json();

            for (const store of json.availabledStores) {
                if (store.regionId === '34') {
                    await prisma.store.create({data: {name: store.title, id: parseInt(store.id)}})
                }
            }

            break
        } catch (e) {
            console.error(e);
            console.error('retrying to fetch stores');
        }
    }

}

const prisma = new PrismaClient();
const browser = await puppeteer.launch();
const page = await browser.newPage();
console.log('browser started')

console.log('checking for cookie')
await page.setExtraHTTPHeaders({'cookie': process.env.COOKIE});
const state = await getState(page, "https://lemanapro.ru/catalogue/");
if (state === undefined) {
    console.error("cookie is bad or expired, update it!")
    process.exit(1);
}
console.log('all good, starting up!');


// console.log('parsing categories');
//await parseCategoriesAndSaveInDb(page, prisma, state);
// console.log('done parsing categories');

console.log('parsing stores');
await parseStoresAndSaveInDb(page, prisma);
console.log('done parsing stores');