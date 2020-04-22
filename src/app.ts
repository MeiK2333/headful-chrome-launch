import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as url from 'url';
import * as playwright from 'playwright';
import { Args } from './args';
import * as extensions from './extensions';

var http = require('http');
var httpProxy = require('http-proxy');

// 启动代理服务
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

const mkdtempAsync = promisify(fs.mkdtemp);
const writeFileAsync = promisify(fs.writeFile);

var proxy = new httpProxy.createProxyServer();
var proxyServer = http.createServer(function (req, res) {
  res.write('Hello World!');
  res.end();
});

proxyServer.on('upgrade', async (req, socket, head) => {
  try {
    const args = Args.parseFromReq(req);
    var browser: playwright.BrowserServer;
    let userDataDir: string = null;

    switch (args.browserType) {
      case 'chrome':
        browser = await playwright.chromium.launchServer({
          executablePath: '/usr/bin/google-chrome',
          headless: false,
          args: [
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            `--proxy-server=${args.proxyServer}`,
            '--no-first-run',
            '--no-default-browser-check'
          ]
        });
        break;
      case 'chromium':
        userDataDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright_dev_chromium_profile-'));
        await fs.copy('./extensions/chromium/defaultChromium', userDataDir);
        //@ts-ignore
        browser = (await playwright.chromium._launchServer({
          headless: false,
          args: [
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            `--proxy-server=${args.proxyServer}`,
            '--no-first-run',
            '--no-default-browser-check',
            `--disable-extensions-except=${Object.values(extensions.extensions).join(',')}`,
            `--load-extensions=${Object.values(extensions.extensions).join(',')}`
          ]
        }, 'server', userDataDir)).browserServer;
        break;
      case 'firefox':
        // 将代理配置写入 Firefox 的配置文件中，并以此配置文件启动
        const proxyServerUrl = url.parse(args.proxyServer);
        const firefoxUserJs = `
user_pref("security.cert_pinning.enforcement_level", 0);
user_pref("security.tls.version.min", 1);
user_pref("network.stricttransportsecurity.preloadlist", false);
user_pref("network.proxy.type", 1);
user_pref("network.proxy.share_proxy_settings", true);
user_pref("network.proxy.http", "${proxyServerUrl.hostname}");
user_pref("network.proxy.http_port", ${proxyServerUrl.port});
user_pref("network.proxy.ssl", "${proxyServerUrl.hostname}");
user_pref("network.proxy.ssl_port", ${proxyServerUrl.port});
      `;
        userDataDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright_dev_firefox_profile-'));
        await writeFileAsync(path.join(userDataDir, "./user.js"), firefoxUserJs);
        //@ts-ignore
        browser = await playwright.firefox._launchServer({
          headless: false
        }, 'server', userDataDir);
        break;
      case 'webkit':
        browser = await playwright.webkit.launchServer({
          headless: false,
          env: {
            ...process.env,
            http_proxy: args.proxyServer,
            https_proxy: args.proxyServer,
            ftp_proxy: args.proxyServer,
            all_proxy: args.proxyServer
          }
        });
        break;
      default:
        console.log(`Unknown browser: ${args.browserType}`);
        socket.end();
        return;
    }

    var timer: NodeJS.Timeout;
    if (args.timeout) {
      timer = setTimeout(async () => {
        await closeBrowser();
        console.log(`Timeout! ${args.browserType}: ${browser.wsEndpoint()} closed`);
      }, args.timeout * 1000 * 60);
    }
    const closeBrowser = async () => {
      clearTimeout(timer);
      await browser.close();
      // 如果创建了临时文件夹，则应该在浏览器关闭时删除
      if (userDataDir) {
        await fs.promises.rmdir(userDataDir, { recursive: true });
      }
      socket.end();
    }

    console.log(`${args.browserType}: ${browser.wsEndpoint()}`);
    socket.on('close', async () => {
      await closeBrowser();
      console.log(`${args.browserType}: ${browser.wsEndpoint()} closed`);
    });
    socket.on('error', async () => {
      await closeBrowser();
      console.log(`${args.browserType}: ${browser.wsEndpoint()} error`);
    });
    proxy.ws(req, socket, head, {
      target: browser.wsEndpoint(),
      ignorePath: true
    });
  } catch (err) {
    console.error(err);
    socket.end();
  }
});

proxyServer.listen(5678);
