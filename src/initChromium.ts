import * as playwright from 'playwright';
import * as extensions from './extensions';

(async () => {
  const userDataDir = './extensions/chromium/defaultChromium';
  //@ts-ignore
  const browser = (await playwright.chromium._launchServer({
    headless: false,
    args: [
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      `--disable-extensions-except=${extensions.extensions.join(',')}`,
      `--load-extensions=${extensions.extensions.join(',')}`
    ]
  }, 'server', userDataDir)).browserServer;
  await extensions.chromiumUseExtension(browser);
  await browser.close();
})();
