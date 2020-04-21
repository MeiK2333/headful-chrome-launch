#!/bin/bash
set -e

_kill_procs() {
  kill -TERM $node
  wait $node
  kill -TERM $xvfb
}

# Relay quit commands to processes
trap _kill_procs SIGTERM SIGINT

Xvfb :1 -screen 0 1920x1080x24 -nolisten tcp -nolisten unix &
xvfb=$!

export DISPLAY=:1

/usr/bin/dumb-init -- ts-node src/app.ts $@ &
node=$!

wait $node
wait $xvfb
