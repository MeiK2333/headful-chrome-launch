import asyncio
import atexit
import errno
import os
import platform
import random
import shutil
import signal
import subprocess
import uuid

import websockets


class Chrome:
    def __init__(self, proxy=None):
        if platform.system() == "Darwin":
            self.launch_args = [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            ]
        else:
            self.launch_args = ["xvfb-run", "-a", "google-chrome"]
        self.temp_filename = str(uuid.uuid4())
        self.debug_port = random.randint(5000, 50000)
        self.launch_args += [
            f"--user-data-dir={self.temp_filename}",
            f"--remote-debugging-port={self.debug_port}",
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
        self.popen = subprocess.Popen(
            self.launch_args, stderr=subprocess.PIPE, preexec_fn=os.setsid
        )
        try_times = 10
        while try_times != 0:
            if not self.popen.stderr.readable:
                await asyncio.sleep(0.1)
            stderr = self.popen.stderr.readline().decode()
            if stderr.startswith("DevTools listening on ws://"):
                self.websockets = stderr.replace("DevTools listening on ", "").strip()
                break
            try_times -= 1

        return self.websockets

    async def kill(self):
        os.killpg(os.getpgid(self.popen.pid), signal.SIGTERM)
        await asyncio.sleep(1)
        try:
            shutil.rmtree(self.temp_filename)
        except OSError as ex:
            if ex.errno != errno.ENOENT:
                raise ex
