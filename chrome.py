import asyncio
import atexit
import os
import subprocess

import websockets


class Chrome:
    def __init__(self, proxy=None):
        self.launch_args = [
            # "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            # "--user-data-dir=chrome-remote-data-dir",
            "xvfb-run",
            "google-chrome",
            "--user-data-dir=$(mktemp -d -t 'chrome-remote_data_dirXXXXX')",
            "--remote-debugging-port=9222",
            "--no-first-run",
            "--no-default-browser-check",
            "--ignore-certificate-errors",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--window-size=1920,1080",
        ]
        if proxy:
            self.launch_args.append(f"--proxy-server={proxy}")
        self.websockets = None
        self.popen = None

    async def launch(self) -> str:
        self.popen = subprocess.Popen(self.launch_args, stderr=subprocess.PIPE)
        try_times = 10
        while try_times != 0:
            if not self.popen.stderr.readable:
                await asyncio.sleep(0.1)
            stderr = self.popen.stderr.readline().decode()
            if stderr.startswith("DevTools listening on ws://"):
                self.websockets = stderr.replace("DevTools listening on ", "").strip()
                break
            try_times -= 1

        def kill():
            self.popen.kill()

        atexit.register(kill)
        return self.websockets

    async def kill(self):
        self.popen.kill()
