import http from 'http';
import url from 'url';
import querystring from 'querystring';

export enum BrowserTypeEnum {
  firefox = 'firefox',
  chrome = 'chrome',
  chromium = 'chromium',
  webkit = 'webkit'
}

export class Args {
  url: string;
  query: Object;
  browserType: BrowserTypeEnum;
  timeout?: number;
  proxyServer: string;
  browserArgs?: Array<string>;

  constructor() {
  }

  static parseFromReq(req: http.IncomingMessage): Args {
    const args = new Args();
    args.url = req.url;
    const parsedURL = url.parse(args.url);
    const bt = parsedURL.pathname.split('/')[1].toLowerCase();
    if (bt in BrowserTypeEnum) {
      args.browserType = bt as BrowserTypeEnum;
    } else {
      throw `Unknown Browser type: ${bt}`;
    }
    args.query = querystring.parse(parsedURL.query);
    if (args.query['timeout']) {
      // timeout 以分钟为单位
      args.timeout = Number(args.query['timeout']);
    }
    args.proxyServer = args.query['proxyServer'] ? args.query['proxyServer'] : null;
    return args;
  }
};
