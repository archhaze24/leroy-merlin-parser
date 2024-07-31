import puppeteer from "puppeteer";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import qratorKey from "./parse/qratorKey.js";
import getAndSetNewQratorKey from "./parse/qratorKey.js";
import parse from "./parse/index.js";
import useProxy from "@stableproxy/puppeteer-page-proxy";
import qratorParse from "./parse/qratorParse/index.js";
import logger from "./logger.js";
import qrator from "./constants/qrator.js";
import proxy from "./parse/proxy.js";

global.__filename = fileURLToPath(import.meta.url);
global.__dirname = dirname(__filename);

const init = async () => {
  const prisma = new PrismaClient();
  try {
    prisma.$connect();
  } catch (e) {
    console.error(`failed to connect prisma client: ${e}`);
  }
  logger.info("database is up");

  const browser = await puppeteer.launch({
    headless: true,
  });
  const page = await browser.newPage();

  await page.setRequestInterception(true);
  await page.setViewport({ width: 1200, height: 800 });
  logger.info("browser started");

  page.on("request", async (request) => {
    // await proxy(request);
    request.continue();
  });

  await page.setCookie({
    name: "cookie_accepted",
    value: "true",
    url: "https://lemanapro.ru",
  });
  await qratorKey(page);
  logger.info("setting qrator_jsid to refresh every 4 minutes");
  setInterval(() => getAndSetNewQratorKey(page), 4 * 60 * 1000);

  logger.info("setting parsing to run every 24 hours");
  setInterval(() => parse(page, prisma), 24 * 60 * 60 * 1000);

  parse(page, prisma);
};

init();
