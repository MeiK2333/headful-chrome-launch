#!/bin/bash
set -e

Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -nolisten unix &
xvfb=$!

export DISPLAY=:99

ts-node src/init.ts
kill -TERM $xvfb
