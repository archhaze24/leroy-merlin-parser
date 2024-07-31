import puppeteer from "puppeteer";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import qratorKey from "./parse/qratorKey.js";
import getAndSetNewQratorKey from "./parse/qratorKey.js";
import parse from "./parse/index.js";
import useProxy from "@stableproxy/puppeteer-page-proxy";

global.__filename = fileURLToPath(import.meta.url);
global.__dirname = dirname(__filename);

const init = async () => {
  const prisma = new PrismaClient();
  try {
    prisma.$connect();
  } catch (e) {
    console.error(`failed to connect prisma client: ${e}`);
  }
  console.log("database is up");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  await page.setViewport({ width: 1200, height: 800 });
  console.log("browser started");

  // page.on("request", async (request) => {
  //   await useProxy(request, {
  //     proxy: "https://217.29.53.100:12118",
  //     method: "GET",
  //     headers: {
  //       "Proxy-Authorization": "Basic dDdGMkJuOkpYQkowQg==",
  //     },
  //   });
  // });

  await qratorKey(page);
  console.log("setting qrator_jsid to refresh every 4 minutes");
  setInterval(() => getAndSetNewQratorKey(page), 4 * 60 * 1000);

  console.log("setting parsing to run every 24 hours");
  setInterval(() => parse(page, prisma), 24 * 60 * 60 * 1000);

  parse(page, prisma);
};

init();
