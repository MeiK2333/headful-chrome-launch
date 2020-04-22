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
      '--lang=zh-CN',
      `--disable-extensions-except=${Object.values(extensions.extensions).join(',')}`,
      `--load-extensions=${Object.values(extensions.extensions).join(',')}`
    ],
    env: {
      ...process.env,
      LANGUAGE: 'zh-CN'
    }
  });
  await chromiumUseExtension(browser);
  await browser.close();
})();

export async function chromiumUseExtension(browserContext: playwright.BrowserContext) {
  const page = await browserContext.newPage();
  await page.goto('chrome://extensions');
  for (let i = 0; i < 5; i++) {
    if (browserContext.pages().length > 2) {
      await browserContext.pages()[2].close();
      break;
    }
    if (i === 4) {
      throw new Error('扩展应用失败');
    }
    await page.waitFor(300 * (i + 1));
  }
  for (const ex of Object.keys(extensions.extensions)) {
    await page.goto('chrome://extensions');
    await page.waitFor(200);
    await page.click(`css=body > extensions-manager >> css=#items-list >> css=#${ex} >> css=#detailsButton`);
    await page.waitFor(200);
    await page.click('css=body > extensions-manager >> css=#viewManager > extensions-detail-view >> css=#allow-incognito');
    await page.waitFor(200);
  }
  await page.waitFor(1000);
};
