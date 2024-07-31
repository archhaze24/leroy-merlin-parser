import { HTTPRequest } from "puppeteer";
import { readFile } from "fs/promises";
import { join } from "path";
import useProxy from "@stableproxy/puppeteer-page-proxy";
import cache from "../cache.js";
import logger from "../logger.js";
import qrator from "../constants/qrator.js";
import randomUseragent from "random-useragent";

export type HttpProxy = {
  url: string;
  auth: {
    name: string;
    password: string;
    hash: string;
  };
};

let proxies: HttpProxy[] = [];
let currentProxy: HttpProxy | undefined;
let counter = 0;

export const changeProxy = async () => {
  await cache.set(`banned:${currentProxy?.url}`, 1, 300 * 1000);

  const getProxy = async (): Promise<HttpProxy> => {
    if (counter === proxies.length) {
      logger.info("proxy counter is reset");
      counter = 0;
    }

    let proxy = proxies[counter];
    const isBanned = await cache.get(`banned:${proxy.url}`);

    if (isBanned) {
      counter++;

      if (proxy === proxies[proxies.length - 1]) {
        proxy = await new Promise((res, rej) => {
          setTimeout(() => {
            res(getProxy());
          }, 300 * 1000);
        });
      } else {
        proxy = await getProxy();
      }
    }

    return proxy;
  };

  const proxy = await getProxy();

  currentProxy = proxy;

  logger.info(`proxy changed to ${proxy.url}`);
};

const proxy = async (request: HTTPRequest) => {
  if (proxies.length === 0) {
    const file = await readFile(join(__dirname, "../proxy.txt"), "utf-8");

    const splitted = file.split("\r\n");

    splitted.forEach((item) => {
      const data = item.split(":");

      proxies.push({
        url: `${data[0]}:${data[1]}`,
        auth: {
          name: data[2],
          password: data[3],
          hash: btoa(data[2] + ":" + data[3]),
        },
      });
    });
  }

  if (!currentProxy) {
    currentProxy = proxies[counter];
    counter++;
  }

  return useProxy(request, {
    proxy: `http://${currentProxy.auth.name}:${currentProxy.auth.password}@${currentProxy.url}`,
  });
};

export default proxy;
