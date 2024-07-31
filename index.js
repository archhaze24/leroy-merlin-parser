import puppeteer from "puppeteer-extra";
import {PrismaClient} from "@prisma/client";
import "dotenv/config";
import * as child_process from "node:child_process";
import {join, dirname} from "path";
import {fileURLToPath} from "url";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let qrator_jsid = "";
// noinspection SpellCheckingInspection
let API_KEY = "nkGKLkscp80GVAQVY8YvajPjzaFTmIS8"; // universal api key

function isIterable(obj) {
    return obj != null && typeof obj[Symbol.iterator] === 'function';
}

async function getAndSetNewQratorKey(page) {
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

                qrator_jsid = data;
                pythonProcess.kill();
                resolve(qrator_jsid);
            });
        });

        qrator_jsid = await pythonProcessPromise;
    } catch (e) {
        console.error(`${e}, retrying`);
    }

    console.log(`got new qrator_jsid: ${qrator_jsid}`);
    await page.setCookie({
        name: "qrator_jsid",
        value: qrator_jsid,
        url: "https://lemanapro.ru",
    });
}

async function getState(page, url) {
    try {
        await page.setCookie({
            name: "qrator_jsid",
            value: qrator_jsid,
            url: "https://lemanapro.ru",
        });
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
        let notIterableInARow = 0;
        let undefinedInARow = 0;
        while (true) {
            console.log(`getting categories from route ${secondLevelCategory}`);
            await new Promise((resolve) => setTimeout(resolve, 6000));
            try {
                const state = await getState(
                    page,
                    `https://lemanapro.ru${secondLevelCategory}`
                );
                if (state.plp === undefined) {
                    undefinedInARow += 1;
                    throw new Error('state is undefined')
                }
                if (!isIterable(state.plp.plp.plp.catalogueStructure.catalogue)) {
                    notIterableInARow += 1;
                    throw new Error('catalogue is not iterable')
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

                undefinedInARow = 0
                notIterableInARow = 0

                break;
            } catch (e) {
                console.error(
                    `failed to get categories from route ${secondLevelCategory}, retrying: ${e}`
                );

                if (undefinedInARow === 6) {
                    // todo: add proxy switching
                    undefinedInARow = 0
                    break
                }

                if (notIterableInARow === 6) {
                    notIterableInARow = 0
                    break
                }
            }
        }
    }
}

async function parseStoresAndSaveInDb(page, db) {
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
                        Cookie: `qrator_jsid=${qrator_jsid}`,
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
                        where: {id: parseInt(store.id)},
                        create: {name: store.title, id: parseInt(store.id)},
                        update: {name: store.title},
                    });
                }
            }

            break;
        } catch (e) {
            console.error(`failed to fetch stores, retrying: ${e}`);
        }
    }
}

async function parseProductsAndSaveInDb(page, db) {
    const categories = await db.category.findMany();

    for (const category of categories) {
        while (true) {
            try {
                await new Promise((resolve) => setTimeout(resolve, 6000));
                const state = await getState(page, `https://lemanapro.ru${category.url}`);
                if ('404-header' in state) {
                    console.log(`got 404 from category ${category.url}, skipping it!`);
                    break
                }
                const pages = Math.ceil(state.plp.plp.plp.products.productsCount / 30);
                for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
                    while (true) {
                        try {
                            await new Promise((resolve) => setTimeout(resolve, 6000));
                            console.log(`getting products from category ${category.url}, page ${pageNumber}`)
                            const state = await getState(page, `https://lemanapro.ru${category.url}/?page=${pageNumber}`);
                            const products = state.plp.plp.plp.products.productsList;
                            for (const product of products) {
                                // todo: this is bannable. find a way to solve it
                                await new Promise((resolve) => setTimeout(resolve, 1000));

                                // noinspection SpellCheckingInspection
                                const stocksRequest = await fetch("https://api.lemanapro.ru/experience/LeroymerlinWebsite/v1/navigation-pdp-api/get-stocks", {
                                    "credentials": "include",
                                    "headers": {
                                        "Cookie": `qrator_jsid=${qrator_jsid}; _regionID=34; cookie_accepted=true`,
                                        "Content-Type": "application/json",
                                        "x-api-key": `${API_KEY}`,
                                    },
                                    "referrer": "https://lemanapro.ru/",
                                    "body": `{"regionCode":"moscow","productId":"${product.productId}","unit":"шт.","currencyKey":"${product.price.currency}","preferedStores":[],"source":"Step"}`,
                                    "method": "POST",
                                });
                                const stocksJSON = await stocksRequest.json();

                                let onlineStocks = 0;
                                if (stocksJSON.longtailCase.isAvailableOnline) {
                                    onlineStocks = stocksJSON.deliveryMethods[0].maxStockAvailable
                                }

                                const productInDb = await db.product.upsert({
                                    where: {id: parseInt(product.productId)},
                                    create: {
                                        id: parseInt(product.productId),
                                        name: product.displayedName,
                                        price: product.price.main_price,
                                        priceCurrency: product.price.currency,
                                        isAvailableOffline: stocksJSON.longtailCase.isAvailableOffline,
                                        onlineStocks: onlineStocks,
                                        isAvailableOnline: stocksJSON.longtailCase.isAvailableOnline,

                                    },
                                    update: {
                                        name: product.displayedName,
                                        price: product.price.main_price,
                                        priceCurrency: product.price.currency,
                                        isAvailableOffline: stocksJSON.longtailCase.isAvailableOffline,
                                        onlineStocks: onlineStocks,
                                        isAvailableOnline: stocksJSON.longtailCase.isAvailableOnline,
                                    }
                                })

                                if (productInDb.isAvailableOffline) {
                                    for (const storeStocks of stocksJSON.stocks) {
                                        await db.storeProduct.upsert({
                                            where: {
                                                productId_storeId: {
                                                    storeId: parseInt(storeStocks.storeCode),
                                                    productId: productInDb.id
                                                }
                                            },
                                            create: {
                                                storeId: parseInt(storeStocks.storeCode),
                                                productId: productInDb.id,
                                                stocks: storeStocks.stockValue,
                                            },
                                            update: {
                                                stocks: storeStocks.stockValue,
                                            }
                                        })
                                    }
                                } else {
                                    await db.storeProduct.deleteMany({where: {productId: productInDb.id}})
                                }

                                await db.categoryProduct.upsert({
                                    where: {
                                        categoryId_productId: {
                                            productId: productInDb.id,
                                            categoryId: category.id
                                        }
                                    },
                                    create: {productId: productInDb.id, categoryId: category.id},
                                    update: {}
                                })
                            }

                            break
                        } catch (e) {
                            console.error(`failed to get products from category ${category.url} on page ${pageNumber}, retrying: ${e}`);
                        }
                    }

                }

                break
            } catch (e) {
                console.error(`failed to get products from category ${category.url}, retrying: ${e}`);
            }
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

    console.log("parsing products");
    await parseProductsAndSaveInDb(page, db);
    console.log("done parsing products");
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
await page.setViewport({width: 1200, height: 800});
console.log("browser started");

await getAndSetNewQratorKey(page);
console.log("setting qrator_jsid to refresh every 4 minutes");
setInterval(() => getAndSetNewQratorKey(page), 4 * 60 * 1000);

console.log("setting parsing to run every 24 hours");
setInterval(() => parse(page, prisma), 24 * 60 * 60 * 1000);

parse(page, prisma);
