import { Page } from "puppeteer";
import qrator from "../../constants/qrator.js";

async function getState(page: Page, url: string): Promise<any> {
  try {
    await page.setCookie({
      name: "qrator_jsid",
      value: qrator.jsid,
      url: "https://lemanapro.ru",
    });
    await page.goto(url);
    return page.evaluate("window.INITIAL_STATE");
  } catch (err) {
    return undefined;
  }
}

export default getState;
