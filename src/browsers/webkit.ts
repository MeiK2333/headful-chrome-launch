import playwright from 'playwright';
import { Args } from '../args';

export async function LaunchWebkit(args: Args, userDataDir: string): Promise<playwright.BrowserServer> {
  let env = process.env;
  if (args.proxyServer) {
    env = {
      ...process.env,
      http_proxy: args.proxyServer,
      https_proxy: args.proxyServer,
      ftp_proxy: args.proxyServer,
      all_proxy: args.proxyServer
    }
  }
  return await playwright.webkit.launchServer({
    headless: false,
    env: env
  });
}
