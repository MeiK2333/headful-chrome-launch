var http = require('http');
var httpProxy = require('http-proxy');
var playwright = require('playwright');

var proxy = new httpProxy.createProxyServer();
var proxyServer = http.createServer(function (req, res) {
  res.write('Hello World!');
  res.end();
});

proxyServer.on('upgrade', async (req, socket, head) => {
  const browserType = req.url.split('/')[1].toLowerCase();
  var browser;
  switch (browserType) {
    case 'chrome':
      // TODO: 使用 Chrome
      browser = await playwright.chromium.launchServer({
        headless: false
      });
      break;
    case 'chromium':
      browser = await playwright.chromium.launchServer({
        headless: false
      });
      break;
    case 'firefox':
      browser = await playwright.firefox.launchServer({
        headless: false
      });
      break;
    case 'webkit':
      browser = await playwright.webkit.launchServer({
        headless: false
      });
      break;
    default:
      browser = await playwright.chromium.launchServer({
        headless: false
      });
  }
  console.log(`${browserType}: ${browser.wsEndpoint()}`);
  socket.on('close', async () => {
    await browser.close();
    console.log(`${browserType}: ${browser.wsEndpoint()} closed`);
  });
  socket.on('error', async () => {
    await browser.close();
    console.log(`${browserType}: ${browser.wsEndpoint()} error`);
  });
  proxy.ws(req, socket, head, {
    target: browser.wsEndpoint(),
    ignorePath: true
  });
});

proxyServer.listen(5678);
