# headful-crawler

## Run

### Dev

```bash
ts-node src/app.ts
```

### Docker

```bash
docker pull meik2333/headful-chrome-launch
docker run --rm -it -p 5678:5678 -p 5900:5900 meik2333/headful-chrome-launch
```

## Example

### Playwright

```typescript
import playwright from 'playwright';
(async () => {
  const browser = await playwright.firefox.connect({ wsEndpoint: 'ws://127.0.0.1:5678/firefox?proxy.username=username&proxy.password=password&proxy.server=http://ip:port&args=--window-size=1920,1080&args=--user-agent=fake' }); // Or 'webkit' or 'firefox'
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://httpbin.org/get');
  await page.screenshot({ path: `example.png` });
  await browser.close()
})();
```

### Puppeteer

```typescript
import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.connect({ browserWSEndpoint:  'ws://127.0.0.1:5678/chrome?proxy.username=username&proxy.password=password&proxy.server=http://ip:port&args=--window-size=1920,1080&args=--user-agent=fake' });
  const page = await browser.newPage();
  await page.goto('https://httpbin.org/get');
  await page.screenshot({ path: `example.png` });
  await browser.close()
})();
```
