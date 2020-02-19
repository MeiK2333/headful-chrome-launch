var http = require('http');
var httpProxy = require('http-proxy');
var playwright = require('playwright');

var proxy = new httpProxy.createProxyServer();
var proxyServer = http.createServer(function (req, res) {
  res.write('Hello World!');
  res.end();
});

proxyServer.on('upgrade', async (req, socket, head) => {
  const browserType = req.url.split('/')[1].toLowerCase()
  var browser;
  switch (browserType) {
    case 'chrome':
      console.log('Chrome');
      browser = playwright.chromium;
      break;
    case 'chromium':
      console.log('Chromium');
      browser = playwright.chromium;
      break;
    case 'firefox':
      console.log('Firefox');
      browser = playwright.firefox;
      break;
    case 'webkit':
      console.log('Webkit');
      browser = playwright.webkit;
      break;
    default:
      console.log('Chrome');
      browser = playwright.chromium;
  }
  const runningBrowser = await browser.launchServer({
    headless: false
  });
  console.log(runningBrowser.wsEndpoint());
  proxy.ws(req, socket, head, {
    target: runningBrowser.wsEndpoint(),
    ignorePath: true
  });
});

proxyServer.listen(5678);
