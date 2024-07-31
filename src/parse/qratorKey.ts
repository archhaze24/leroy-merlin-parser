import { Page } from "puppeteer";
import child_process from "child_process";
import qrator from "../constants/qrator.js";
import { join } from "path";
import logger from "../logger.js";

async function getAndSetNewQratorKey(page: Page) {
  try {
    const pythonProcessPromise = new Promise((resolve, reject) => {
      const pythonProcess = child_process.spawn("python", [
        join(__dirname, "../qrator_jsid.py"),
      ]);
      pythonProcess.stdout.on("data", (data) => {
        data = data.toString().trim();
        if (data.length !== 64) {
          reject("can't get qrator_jsid");
        }

        qrator.jsid = data;
        pythonProcess.kill();
        resolve(qrator.jsid);
      });

      pythonProcess.stderr.on("error", (err) => {
        logger.error(err);
      });
    });

    qrator.jsid = (await pythonProcessPromise) as string;
  } catch (e) {
    console.error(`${e}, retrying`);
  }

  logger.info(`got new qrator_jsid: ${qrator.jsid}`);
  await page.setCookie({
    name: "qrator_jsid",
    value: qrator.jsid,
    url: "https://lemanapro.ru",
  });
}

export default getAndSetNewQratorKey;
