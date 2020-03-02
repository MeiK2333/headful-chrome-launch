var proxyChain = require('proxy-chain');

const PROXY_PORT = 8080;

const server = new proxyChain.Server({
  port: PROXY_PORT,
  verbose: false,
  prepareRequestFunction: ({
    request,
    username,
    password,
    hostname,
    port,
    isHttp,
  }) => {
    // Firefox 启动时会默认请求这些网站，这些请求不会附带身份信息，如果不忽略这些请求，Firefox 将会卡住无法关闭
    const filterUrls = [
      'detectportal.firefox.com',
      'location.services.mozilla.com',
      'firefox.settings.services.mozilla.com',
      'snippets.cdn.mozilla.net',
      'shavar.services.mozilla.com',
      'push.services.mozilla.com',
      'content-signature-2.cdn.mozilla.net',
      'ocsp.digicert.com',
      'ocsp.sca1b.amazontrust.com',
      'tracking-protection.cdn.mozilla.net',
      'search.services.mozilla.com'
    ]
    const filter = filterUrls.some((urlPart) => hostname.includes(urlPart));
    if (filter) {
      return {
        upstreamProxyUrl: null
      }
    }
    if (username) {
      console.log(hostname, password);
    }
    return {
      requestAuthentication: username === null,
      upstreamProxyUrl: username === 'proxy'
        ? password
        : null
    }
  },
});

server.listen(() => {
  console.log(`Router Proxy server is listening on port ${PROXY_PORT}`);
});
