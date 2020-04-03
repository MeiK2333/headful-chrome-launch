import * as http from 'http';
import * as url from 'url';
import * as querystring from 'querystring';

export enum browserTypeEnum {
  firefox = 'firefox',
  chrome = 'chrome',
  chromium = 'chromium',
  webkit = 'webkit'
}

export class Args {
  url: string;
  query: Object;
  browserType: browserTypeEnum;
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
    if (bt in browserTypeEnum) {
      args.browserType = bt as browserTypeEnum;
    } else {
      throw `Unknown Browser type: ${bt}`;
    }
    args.query = querystring.parse(parsedURL.query);
    if (args.query['timeout']) {
      // timeout 以分钟为单位
      args.timeout = Number(args.query['timeout']);
    }
    args.proxyServer = args.query['proxyServer'] ? args.query['proxyServer'] : 'http://127.0.0.1:8080';
    const psu = url.parse(args.proxyServer);
    return args;
  }
};
