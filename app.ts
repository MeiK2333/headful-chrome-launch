import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

var http = require('http');
var httpProxy = require('http-proxy');
var playwright = require('playwright');

// start proxy server
require('./proxy');

function promisify(nodeFunction: Function): Function {
  function promisified(...args: any[]) {
    return new Promise((resolve, reject) => {
      function callback(err: any, ...result: any[]) {
        if (err)
          return reject(err);
        if (result.length === 1)
          return resolve(result[0]);
        return resolve(result);
      }
      nodeFunction.call(null, ...args, callback);
    });
  }
  return promisified;
}

const firefoxUserJs = `
user_pref("security.tls.version.min", 1);
user_pref("network.stricttransportsecurity.preloadlist", false);
user_pref("network.proxy.type", 1);
user_pref("network.proxy.share_proxy_settings", true);
user_pref("network.proxy.http", "127.0.0.1");
user_pref("network.proxy.http_port", 8080);
user_pref("network.proxy.ssl", "127.0.0.1");
user_pref("network.proxy.ssl_port", 8080);
`;

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
        headless: false,
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--proxy-server=http://127.0.0.1:8080',
          '--no-first-run',
          '--no-default-browser-check'
        ]
      });
      break;
    case 'chromium':
      browser = await playwright.chromium.launchServer({
        headless: false,
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--proxy-server=http://127.0.0.1:8080',
          '--no-first-run',
          '--no-default-browser-check'
        ]
      });
      break;
    case 'firefox':
      browser = await playwright.firefox.launchServer({
        headless: false
      });
      console.log(browser.process().spawnargs);
      break;
    case 'webkit':
      browser = await playwright.webkit.launchServer({
        headless: false
      });
      break;
    default:
      return;
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
