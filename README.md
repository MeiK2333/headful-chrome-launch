# headful-crawler

## Run

```bash
docker pull meik2333/headful-chrome-launch
docker run --rm -it -p 5678:5678 meik2333/headful-chrome-launch
```

## Example

```javascript
const { chromium, firefox, webkit } = require('playwright');
(async () => {
  const browser = await firefox.connect({ wsEndpoint: 'ws://127.0.0.1:5678/firefox/' }); // Or 'webkit' or 'firefox'
  const context = await browser.newContext({
    httpCredentials: {
        username: 'proxy',
        password: 'http://ip:port'
      }
  });
  const page = await context.newPage();
  await page.goto('https://httpbin.org/get');
  await page.screenshot({ path: `example.png` });
  await browser.close()
})();
```
