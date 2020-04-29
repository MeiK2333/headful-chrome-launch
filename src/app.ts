import axios from 'axios';
import Cookies from 'cookies';
import fs from 'fs-extra';
import http from 'http';
import httpProxy from 'http-proxy';
import url from 'url';
import querystring from 'querystring';

import { Args, BrowserTypeEnum } from './args';
import { LaunchBrowser } from './browser';
import { logger } from './logger';

const runningBrowser: Array<LaunchBrowser> = [];

const httpProxyServer = httpProxy.createProxyServer();
httpProxyServer.on('error', (err) => {
  logger.info(err.message);
  console.error(err);
});

const httpServer = http.createServer(async (req, res) => {
  let host = req.headers.host;

  const parsedURL = url.parse(req.url);
  const query = querystring.parse(parsedURL.query);

  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const data = await fs.promises.readFile('./src/inspector.html');
    res.end(data);
  } else if (req.url.startsWith('/json')) {
    res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    if (req.url.startsWith('/json?')) {
      const proxyUrl = query['proxyUrl'];
      const resp = await axios.get(`${proxyUrl}/json`);
      for (const item of resp.data) {
        item.devtoolsFrontendUrl = item.devtoolsFrontendUrl.replace('ws=', `proxyUrl=${proxyUrl}&ws=${host}/devtools?ws://`);
        item.webSocketDebuggerUrl = `ws://${host}/devtools?` + item.webSocketDebuggerUrl
      }
      res.end(JSON.stringify(resp.data, null, 2));
    } else if (req.url.startsWith('/json/version')) {
      const proxyUrl = query['proxyUrl'];
      const resp = await axios.get(`${proxyUrl}/json/version`);
      res.end(JSON.stringify(resp.data, null, 2));
    } else if (req.url === '/json/browsers') {
      const data = [];
      for (const item of runningBrowser) {
        data.push({
          type: item.browserType,
          wsEndpoint: item.browserServer.wsEndpoint(),
          userDataDir: item.userDataDir
        })
      }
      res.end(JSON.stringify(data, null, 2));
    } else {
      res.end('Hello World!');
    }
  } else if (req.url.startsWith('/devtools')) {
    // 因为传递的问题，此处很难直接以 Url 参数的方式传递代理目标
    // 只能通过设置 Cookies 来实现
    const cookies = new Cookies(req, res);
    const proxyUrl = cookies.get('proxyUrl');
    httpProxyServer.web(req, res, {
      target: proxyUrl
    });
  } else {
    res.end('Hello World!');
  }
});

httpServer.on('upgrade', async (req, socket, head) => {
  // 页面调试，仅转发 ws，不需要启动新的浏览器
  if (req.url.startsWith('/devtools')) {
    const parsedURL = url.parse(req.url);
    httpProxyServer.ws(req, socket, head, {
      target: parsedURL.query,
      ignorePath: true
    });
    return;
  }

  const args = Args.parseFromReq(req);
  const launchBrowser = await LaunchBrowser.create(args);
  const browser = launchBrowser.browserServer;
  const wsEndpoint = browser.wsEndpoint();

  if ([BrowserTypeEnum.chrome, BrowserTypeEnum.chromium].includes(launchBrowser.browserType)) {
    runningBrowser.push(launchBrowser);
  }

  logger.info(`${args.browserType}: ${wsEndpoint}`);
  const clean = async () => {
    const index = runningBrowser.indexOf(launchBrowser);
    if (index !== -1) {
      runningBrowser.splice(index, 1);
    }
    await launchBrowser.clean();
    socket.end();
  }
  socket.on('close', async () => {
    await clean();
    logger.info(`${args.browserType}: ${wsEndpoint} closed`);
  });
  socket.on('error', async () => {
    await clean();
    logger.info(`${args.browserType}: ${wsEndpoint} error`);
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