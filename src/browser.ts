import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import playwright from 'playwright';

import { Args, BrowserTypeEnum } from './args';
import { LaunchChrome } from './browsers/chrome';
import { LaunchChromium } from './browsers/chromium';
import { LaunchFirefox } from './browsers/firefox';
import { LaunchWebkit } from './browsers/webkit';
import { logger } from './logger';

export class LaunchBrowser {
  browserType: BrowserTypeEnum = null;
  browserServer: playwright.BrowserServer = null;
  userDataDir: string = null;
  timer: NodeJS.Timeout;

  private constructor() { }

  static async create(args: Args): Promise<LaunchBrowser> {
    const launchBrowser = new LaunchBrowser();
    launchBrowser.userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'headful_chrome_launch_'));
    logger.debug(`userDataDir: ${launchBrowser.userDataDir}`);

    switch (args.browserType) {
      case 'chrome':
        launchBrowser.browserServer = await LaunchChrome(args, launchBrowser.userDataDir);
        break;
      case 'chromium':
        launchBrowser.browserServer = await LaunchChromium(args, launchBrowser.userDataDir);
        break;
      case 'firefox':
        launchBrowser.browserServer = await LaunchFirefox(args, launchBrowser.userDataDir);
        break;
      case 'webkit':
        launchBrowser.browserServer = await LaunchWebkit(args, launchBrowser.userDataDir);
        break;
      default:
        logger.warn(`Unknown browser: ${args.browserType}`);
        return null;
    }
    launchBrowser.browserType = args.browserType;

    if (args.timeout) {
      launchBrowser.timer = setTimeout(async () => {
        logger.info(`Timeout! ${args.browserType}: ${launchBrowser.browserServer.wsEndpoint()}`);
      }, args.timeout * 1000 * 60);
    }

    return launchBrowser;
  }

  async clean() {
    await this.browserServer.close();
    clearTimeout(this.timer);
    if (fs.existsSync(this.userDataDir)) {
      logger.debug(`remove ${this.userDataDir}`);
      fs.rmdirSync(this.userDataDir, { recursive: true });
    }
  }
}
