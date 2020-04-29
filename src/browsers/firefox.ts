import playwright from 'playwright';
import fs from 'fs-extra';
import url from 'url';
import path from 'path';
import { Args } from '../args';

export async function LaunchFirefox(args: Args, userDataDir: string): Promise<playwright.BrowserServer> {
  let firefoxUserJs = `
  user_pref("security.cert_pinning.enforcement_level", 0);
  user_pref("security.tls.version.min", 1);
  user_pref("network.stricttransportsecurity.preloadlist", false);
  `;
  if (args.proxyServer) {
    // 将代理配置写入 Firefox 的配置文件中，并以此配置文件启动
    const proxyServerUrl = url.parse(args.proxyServer);
    firefoxUserJs = `
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
  }
  await fs.writeFile(path.join(userDataDir, "./user.js"), firefoxUserJs);
  //@ts-ignore
  let browserServer = await playwright.firefox._launchServer({
    headless: false
  }, 'server', userDataDir);
  return browserServer;
}