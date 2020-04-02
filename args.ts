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
      args.timeout = Number(args.query['timeout']);
      // timeout 最小为一分钟
      if (args.timeout < 60 * 1000) {
        args.timeout = 60 * 1000;
      }
    }
    return args;
  }
};
