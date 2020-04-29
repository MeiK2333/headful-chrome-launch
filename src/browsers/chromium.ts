import playwright from 'playwright';
import fs from 'fs-extra';

import { Args } from '../args';
import * as extensions from '../extensions';

export async function LaunchChromium(args: Args, userDataDir: string): Promise<playwright.BrowserServer> {
  await fs.copy('./extensions/chromium/defaultChromium', userDataDir);
  //@ts-ignore
  let browserServer = (await playwright.chromium._launchServer({
    headless: false,
    args: [
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      args.proxyServer ? `--proxy-server=${args.proxyServer}` : ``,
      '--no-first-run',
      '--no-default-browser-check',
      '--lang=zh-CN',
      `--disable-extensions-except=${Object.values(extensions.extensions).join(',')}`,
      `--load-extensions=${Object.values(extensions.extensions).join(',')}`
    ],
    env: {
      ...process.env,
      LANGUAGE: 'zh-CN'
    }
  }, 'server', userDataDir)).browserServer;
  return browserServer;
}
