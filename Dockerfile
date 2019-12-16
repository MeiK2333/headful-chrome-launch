FROM python:3.8.0-buster

COPY ./sources.list /etc/apt/

RUN cd /tmp && \
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -  && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'

RUN apt-get update && \
    apt-get install -yq \
    ca-certificates \
    ffmpeg \
    fontconfig \
    fonts-indic \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-thai-tlwg \
    gconf-service \
    google-chrome-stable \
    libappindicator1 \
    libappindicator3-1 \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    locales \
    lsb-release \
    nginx \
    pdftk \
    unzip \
    wget \
    x11-apps \
    x11-xkb-utils \
    x11vnc \
    xdg-utils \
    xfonts-100dpi \
    xfonts-75dpi \
    xfonts-cyrillic \
    xfonts-scalable \
    xvfb

RUN pip install -i https://mirrors.aliyun.com/pypi/simple/ mitmproxy websockets aiohttp

RUN apt-get -qq clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY . /app

WORKDIR /app

CMD ["python", "run.py"]
