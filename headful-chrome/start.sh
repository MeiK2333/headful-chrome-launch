nginx
xvfb-run google-chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=$(mktemp -d -t 'chrome-remote_data_dirXXXXX') --ignore-certificate-errors --disable-gpu --no-sandbox --disable-dev-shm-usage --window-size=1920,1080
