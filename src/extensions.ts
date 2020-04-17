import * as playwright from 'playwright';

export const extensions = [
  './extensions/chromium/fhkphphbadjkepgfljndicmgdlndmoke/0.1.1_0',
  './extensions/chromium/fjkmabmdepjfammlpliljpnbhleegehm/0.2.6_0',
  './extensions/chromium/lanfdkkpgfjfdikkncbnojekcppdebfp/0.1.6_0',
  './extensions/chromium/olnbjpaejebpnokblkepbphhembdicik/0.1.3_0',
  './extensions/chromium/pcbjiidheaempljdefbdplebgdgpjcbe/0.1.4_0',
  './extensions/chromium/pkehgijcmpdhfbdbbnkijodmdjhbjlgp/2020.2.19_0',
];

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
  for (let i = 0; i < extensions.length; i++) {
    await page.goto('chrome://extensions');
    await page.waitFor(200);
    await page.click(`css=body > extensions-manager >> css=#items-list >> css=#${extensions[i].split('/')[3]} >> css=#detailsButton`);
    await page.waitFor(200);
    await page.click('css=body > extensions-manager >> css=#viewManager > extensions-detail-view >> css=#allow-incognito');
    await page.waitFor(200);
  }
  await page.waitFor(1000);
};
