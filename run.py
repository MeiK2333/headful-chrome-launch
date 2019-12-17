import asyncio
import os

import websockets

from chrome import Chrome


async def master(websocket, path):
    chrome = Chrome(proxy=os.environ.get("proxy-server", None))
    try:
        await chrome.launch()
        async with websockets.connect(
            chrome.websockets, ping_interval=None, max_size=2 ** 30
        ) as chrome_websocket:
            while True:
                ws = websocket.recv()
                cws = chrome_websocket.recv()
                wc = websocket.wait_closed()
                cwc = chrome_websocket.wait_closed()
                done, pending = await asyncio.wait(
                    [ws, cws, wc, cwc], return_when=asyncio.FIRST_COMPLETED
                )
                for task in pending:
                    task.cancel()
                is_closed = False
                for task in done:
                    value = task.result()
                    if task._coro == ws:
                        await chrome_websocket.send(value)
                    elif task._coro == cws:
                        await websocket.send(value)
                    elif task._coro == wc:
                        is_closed = True
                    elif task._coro == cwc:
                        is_closed = True
                if is_closed:
                    break
    finally:
        await chrome.kill()


if __name__ == "__main__":
    master_server = websockets.serve(master, "0.0.0.0", 5678, max_size=2 ** 30)
    asyncio.get_event_loop().run_until_complete(master_server)
    asyncio.get_event_loop().run_forever()
