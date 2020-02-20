from urllib.parse import urlparse

from mitmproxy import ctx, http

from logger import logger


def request(flow: http.HTTPFlow) -> None:
    if flow.request.method == "CONNECT":
        return
    if flow.live:
        proxy = flow.request.headers.get("mitmproxy")
        if not proxy:
            return
        logger.debug(f"use proxy {proxy}")
        del flow.request.headers["mitmproxy"]
        parsed_proxy = urlparse(proxy)

        host = parsed_proxy.hostname
        port = parsed_proxy.port or 80
        username = parsed_proxy.username
        password = parsed_proxy.password
        if username and password:
            ctx.options.upstream_auth = f"{username}:{password}"
        flow.live.change_upstream_proxy_server((host, port))
