import asyncio

import websockets

chrome_ws_set = set()


async def register(websocket, path):
    chrome_ws_set.add(websocket)
    try:
        while True:
            await asyncio.sleep(3)
            await websocket.ping()
    finally:
        chrome_ws_set.remove(websocket)


async def master(websocket, path):
    chrome_ws = chrome_ws_set.pop()
    while True:
        ws = websocket.recv()
        cws = chrome_ws.recv()
        wc = websocket.wait_closed()
        done, pending = await asyncio.wait(
            [ws, cws, wc], return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
        is_closed = False
        for task in done:
            value = task.result()
            if task._coro == ws:
                await chrome_ws.send(value)
            elif task._coro == cws:
                await websocket.send(value)
            elif task._coro == wc:
                is_closed = True
        if is_closed:
            break
    chrome_ws_set.add(chrome_ws)
    await websocket.close()


if __name__ == "__main__":
    register_server = websockets.serve(register, "0.0.0.0", 8765)
    master_server = websockets.serve(master, "0.0.0.0", 5678)

    asyncio.get_event_loop().run_until_complete(register_server)
    asyncio.get_event_loop().run_until_complete(master_server)
    asyncio.get_event_loop().run_forever()
