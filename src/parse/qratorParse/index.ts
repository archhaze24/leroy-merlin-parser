import puppeteer from "puppeteer";
import qrator from "../../constants/qrator.js";
import logger from "../../logger.js";
import proxy, { changeProxy } from "../proxy.js";

declare global {
  interface Window {
    cdc_adoQpoasnfa76pfcZLmcfl_Array: any;
    cdc_adoQpoasnfa76pfcZLmcfl_Promise: any;
    cdc_adoQpoasnfa76pfcZLmcfl_Symbol: any;
  }
}

const qratorParse = async () => {
  const browser = await puppeteer.launch({
    args: ["--disable-blink-features=AutomationControlled"],
    headless: true,
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on("request", async (request) => {
    await proxy(request);
  });

  await page.evaluate(() => {
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });

  await page.setCookie({
    name: "cookie_accepted",
    value: "true",
    url: "https://lemanapro.ru",
  });
  await page.goto("https://lemanapro.ru");

  setTimeout(async () => {
    const cookies = await page.cookies();

    const cookie = cookies.find((cookie) => cookie.name === "qrator_jsid");

    if (cookie) {
      logger.info("qrator_jsid parsed");
      qrator.jsid = cookie.value;
    } else {
      logger.error("qrator banned");
      await changeProxy();
      await qratorParse();
    }
    browser.close();
  }, 5000);
};

export default qratorParse;
