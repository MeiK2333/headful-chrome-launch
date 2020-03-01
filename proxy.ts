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
        if (username) {
            console.log(username, password);
        }
        return {
            requestAuthentication: username === null,
            upstreamProxyUrl: username === 'proxy'
                ? Buffer.from(password || '', 'base64').toString('ascii')
                : null
        }
    },
});

server.listen(() => {
    console.log(`Router Proxy server is listening on port ${PROXY_PORT}`);
});
