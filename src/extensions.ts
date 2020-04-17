import * as playwright from 'playwright';

export const extensions = [
  '/app/src/extensions/chromium/fhkphphbadjkepgfljndicmgdlndmoke/0.1.1_0',
  '/app/src/extensions/chromium/fjkmabmdepjfammlpliljpnbhleegehm/0.2.6_0',
  '/app/src/extensions/chromium/lanfdkkpgfjfdikkncbnojekcppdebfp/0.1.6_0',
  '/app/src/extensions/chromium/olnbjpaejebpnokblkepbphhembdicik/0.1.3_0',
  '/app/src/extensions/chromium/pcbjiidheaempljdefbdplebgdgpjcbe/0.1.4_0',
  '/app/src/extensions/chromium/pkehgijcmpdhfbdbbnkijodmdjhbjlgp/2020.2.19_0',
];

export async function chromiumUseExtension(browserServer: playwright.BrowserServer) {
  const browser = await playwright.chromium.connect({
    wsEndpoint: browserServer.wsEndpoint()
  });
  //@ts-ignore
  const browserContext = browser._defaultContext;
  const page = await browserContext.newPage();
  for (let i = 0; i < extensions.length; i++) {
    await page.goto('chrome://extensions');
    if (i === 0) {
      let j = 0;
      for (j = 0; j < 5; j++) {
        const t = await browserContext.pages();
        if (t.length > 1) {
          await t[1].close();
          break;
        }
        await page.waitFor(300 * (j + 1));
      }
      if (j === 5) {
        console.log('扩展应用失败');
        return;
      }
    }
    await page.click(`css=body > extensions-manager >> css=#items-list >> css=#${extensions[i].split('/')[5]} >> css=#detailsButton`);
    await page.click('css=body > extensions-manager >> css=#viewManager > extensions-detail-view >> css=#allow-incognito');
  }
};
