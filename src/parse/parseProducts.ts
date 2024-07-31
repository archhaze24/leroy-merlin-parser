import { Page } from "puppeteer";
import getState from "./helpers/getState.js";
import { PrismaClient } from "@prisma/client";
import qrator from "../constants/qrator.js";
import api from "../constants/api.js";

async function parseProductsAndSaveInDb(page: Page, db: PrismaClient) {
  const categories = await db.category.findMany();

  for (const category of categories) {
    while (true) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 6000));
        const state = await getState(
          page,
          `https://lemanapro.ru${category.url}`
        );
        if ("404-header" in state) {
          console.log(`got 404 from category ${category.url}, skipping it!`);
          break;
        }
        const pages = Math.ceil(state.plp.plp.plp.products.productsCount / 30);
        for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
          while (true) {
            try {
              await new Promise((resolve) => setTimeout(resolve, 6000));
              console.log(
                `getting products from category ${category.url}, page ${pageNumber}`
              );
              const state = await getState(
                page,
                `https://lemanapro.ru${category.url}/?page=${pageNumber}`
              );
              const products = state.plp.plp.plp.products.productsList;
              for (const product of products) {
                // todo: this is bannable. find a way to solve it
                await new Promise((resolve) => setTimeout(resolve, 1000));

                // noinspection SpellCheckingInspection
                const stocksRequest = await fetch(
                  "https://api.lemanapro.ru/experience/LeroymerlinWebsite/v1/navigation-pdp-api/get-stocks",
                  {
                    credentials: "include",
                    headers: {
                      Cookie: `qrator_jsid=${qrator.jsid}; _regionID=34; cookie_accepted=true`,
                      "Content-Type": "application/json",
                      "x-api-key": `${api.key}`,
                    },
                    referrer: "https://lemanapro.ru/",
                    body: `{"regionCode":"moscow","productId":"${product.productId}","unit":"шт.","currencyKey":"${product.price.currency}","preferedStores":[],"source":"Step"}`,
                    method: "POST",
                  }
                );
                const stocksJSON = await stocksRequest.json();

                let onlineStocks = 0;
                if (stocksJSON.longtailCase.isAvailableOnline) {
                  onlineStocks =
                    stocksJSON.deliveryMethods[0].maxStockAvailable;
                }

                const productInDb = await db.product.upsert({
                  where: { id: parseInt(product.productId) },
                  create: {
                    id: parseInt(product.productId),
                    name: product.displayedName,
                    price: product.price.main_price,
                    priceCurrency: product.price.currency,
                    isAvailableOffline:
                      stocksJSON.longtailCase.isAvailableOffline,
                    onlineStocks: onlineStocks,
                    isAvailableOnline:
                      stocksJSON.longtailCase.isAvailableOnline,
                  },
                  update: {
                    name: product.displayedName,
                    price: product.price.main_price,
                    priceCurrency: product.price.currency,
                    isAvailableOffline:
                      stocksJSON.longtailCase.isAvailableOffline,
                    onlineStocks: onlineStocks,
                    isAvailableOnline:
                      stocksJSON.longtailCase.isAvailableOnline,
                  },
                });

                if (productInDb.isAvailableOffline) {
                  for (const storeStocks of stocksJSON.stocks) {
                    await db.storeProduct.upsert({
                      where: {
                        productId_storeId: {
                          storeId: parseInt(storeStocks.storeCode),
                          productId: productInDb.id,
                        },
                      },
                      create: {
                        storeId: parseInt(storeStocks.storeCode),
                        productId: productInDb.id,
                        stocks: storeStocks.stockValue,
                      },
                      update: {
                        stocks: storeStocks.stockValue,
                      },
                    });
                  }
                } else {
                  await db.storeProduct.deleteMany({
                    where: { productId: productInDb.id },
                  });
                }

                await db.categoryProduct.upsert({
                  where: {
                    categoryId_productId: {
                      productId: productInDb.id,
                      categoryId: category.id,
                    },
                  },
                  create: {
                    productId: productInDb.id,
                    categoryId: category.id,
                  },
                  update: {},
                });
              }

              break;
            } catch (e) {
              console.error(
                `failed to get products from category ${category.url} on page ${pageNumber}, retrying: ${e}`
              );
            }
          }
        }

        break;
      } catch (e) {
        console.error(
          `failed to get products from category ${category.url}, retrying: ${e}`
        );
      }
    }
  }
}

export default parseProductsAndSaveInDb;
