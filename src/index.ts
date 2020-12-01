import playwright, { BrowserServer, BrowserType } from 'playwright';
import puppeteer, { Browser } from 'puppeteer';
import httpProxy from 'http-proxy';
import http from 'http';
import url from 'url';
import querystring from 'querystring';
import { logger } from './logger';
import { extensions } from './extensions';

const httpProxyServer = httpProxy.createProxyServer();
httpProxyServer.on('error', (err) => {
  logger.info(err.message);
  console.error(err);
});
const httpServer = http.createServer(async (req, res) => {
  res.end('Hello World!');
});

httpServer.on('upgrade', async (req, socket, head) => {
  // chromium/firefox/webkit: playwright
  // chrome: puppeteer
  let browser: BrowserServer | Browser;
  let wsEndpoint: string;
  try {
    const parsedUrl = url.parse(req.url);
    const args = {
      ...{
        pathname: '/chrome',
      },
      ...parsedUrl,
    };
    let type: string;
    switch (args.pathname.toLowerCase()) {
      case '/chrome': type = 'chrome'; break;
      case '/chromium': type = 'chromium'; break;
      case '/firefox': type = 'firefox'; break;
      case '/webkit': type = 'webkit'; break;
      default: type = 'chrome'; break;
    }

    logger.info(`launch browser: ${type}`);
    const query = querystring.parse(args.query);
    const launchArgs: string[] = [];
    if (query['args']) {
      if (typeof query['args'] === 'string') {
        launchArgs.push(query['args']);
      } else {
        launchArgs.push(...query['args']);
      }
    }

    if (typeof query['proxy.server'] === 'object'
      || typeof query['proxy.username'] === 'object'
      || typeof query['proxy.password'] === 'object') {
      return;
    }

    if (type === 'chrome') {
      if (query['proxy.server']) {
        launchArgs.push(`--proxy-server=${query['proxy.server']}`);
      }
      launchArgs.push(...[
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        `--disable-extensions-except=${Object.values(extensions).join(',')}`,
        `--load-extensions=${Object.values(extensions).join(',')}`
      ])
      browser = await puppeteer.launch({
        headless: false,
        executablePath: '/usr/bin/google-chrome',
        env: { ...process.env },
        args: launchArgs
      });
      wsEndpoint = browser.wsEndpoint();
    } else {
      const browserType: BrowserType<any> = playwright[type];
      browser = await browserType.launchServer({
        headless: false,
        env: { ...process.env },
        chromiumSandbox: false,
        proxy: {
          server: query['proxy.server'],
          username: query['proxy.username'],
          password: query['proxy.password']
        },
        args: launchArgs
      });
      wsEndpoint = browser.wsEndpoint();
    }
  } catch (e) {
    logger.error(e);
    await browser.close();
    return;
  }
  socket.on('close', async () => {
    await browser.close();
  });
  socket.on('error', async () => {
    await browser.close();
  });

  httpProxyServer.ws(req, socket, head, {
    target: wsEndpoint,
    ignorePath: true
  });
});

httpServer.listen(5678, () => {
  logger.info('server running on http://127.0.0.1:5678/');
});

httpServer.on('error', (err) => {
  logger.error(`${err.message}`);
  console.error(err);
});
