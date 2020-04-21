import * as playwright from 'playwright';
import * as fs from 'fs-extra';
import * as extensions from './extensions';

(async () => {
  // const access = fs.createWriteStream('/dev/null');
  // process.stdout.write = process.stderr.write = access.write.bind(access);
  const userDataDir = './extensions/chromium/defaultChromium';
  if (fs.existsSync(userDataDir)) {
    fs.rmdirSync(userDataDir, { recursive: true });
  }
  const browser = await playwright.chromium.launchPersistentContext(userDataDir, {
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
  });
  await extensions.chromiumUseExtension(browser);
  await browser.close();
})();
