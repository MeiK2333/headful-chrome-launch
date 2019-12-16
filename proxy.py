from logger import logger

from mitmproxy import http


def request(flow: http.HTTPFlow) -> None:
    if flow.request.method == "CONNECT":
        return
    if flow.live:
        proxy = flow.request.headers.get("mitmproxy")
        if not proxy:
            return
        logger.debug(f"use proxy {proxy}")
        del flow.request.headers["mitmproxy"]
        host, port = proxy.split(":")
        flow.live.change_upstream_proxy_server((host, int(port)))
