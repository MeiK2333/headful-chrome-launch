import asyncio
import os
import subprocess

import websockets

MASTER_WS_URI = os.getenv("MASTER_WS_URI")


def start_chrome() -> str:
    args = [
        # "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        # "--user-data-dir=chrome-remote-data-dir",
        "xvfb-run",
        "google-chrome",
        "--remote-debugging-port=9222",
        "--no-first-run",
        "--no-default-browser-check",
        "--ignore-certificate-errors",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1920,1080",
    ]
    popen = subprocess.Popen(args, stderr=subprocess.PIPE)
    chrome_ws = None
    try_times = 10
    while try_times != 0:
        stderr = popen.stderr.readline().decode()
        if stderr.startswith("DevTools listening on ws://"):
            chrome_ws = stderr.replace("DevTools listening on ", "").strip()
            break
        try_times -= 1
    return chrome_ws


CHROME_WS_URI = start_chrome()
print(f"Chrome DevTools listening on: {CHROME_WS_URI}")


async def worker():
    async with websockets.connect(
        CHROME_WS_URI, ping_interval=None
    ) as chrome_websocket:
        async with websockets.connect(
            MASTER_WS_URI, ping_interval=None
        ) as master_websocket:
            while True:
                mws = master_websocket.recv()
                cws = chrome_websocket.recv()
                done, pending = await asyncio.wait(
                    [mws, cws], return_when=asyncio.FIRST_COMPLETED
                )
                for task in pending:
                    task.cancel()
                for task in done:
                    value = task.result()
                    if task._coro == mws:
                        await chrome_websocket.send(value)
                    elif task._coro == cws:
                        await master_websocket.send(value)


if __name__ == "__main__":
    if not CHROME_WS_URI:
        raise "start Chrome failure!"
    if not MASTER_WS_URI:
        raise "miss MASTER_WS_URI!"
    asyncio.get_event_loop().run_until_complete(worker())
