import playwright from 'playwright';
import { Args } from '../args';

export async function LaunchChrome(args: Args, userDataDir: string): Promise<playwright.BrowserServer> {
  return await playwright.chromium.launchServer({
    executablePath: '/usr/bin/google-chrome',
    headless: false,
    args: [
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      args.proxyServer ? `--proxy-server=${args.proxyServer}` : ``,
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });
}