FROM ubuntu:bionic

ENV TZ=America/New_York
ENV DEBIAN_FRONTEND=noninteractive

# Copy from https://github.com/microsoft/playwright/blob/master/docs/docker/Dockerfile.bionic
# Install node12
RUN apt-get update && apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_12.x | bash - && \
    apt-get install -y nodejs

# Install WebKit dependencies
RUN apt-get install -y libwoff1 \
    libopus0 \
    libwebp6 \
    libwebpdemux2 \
    libenchant1c2a \
    libgudev-1.0-0 \
    libsecret-1-0 \
    libhyphen0 \
    libgdk-pixbuf2.0-0 \
    libegl1 \
    libnotify4 \
    libxslt1.1 \
    libevent-2.1-6 \
    libgles2 \
    libvpx5

# Install Chromium dependencies
RUN apt-get install -y libnss3 \
    libxss1 \
    libasound2

# Install Firefox dependencies
RUN apt-get install -y libdbus-glib-1-2

# Add user so we don't need --no-sandbox in Chromium
RUN groupadd -r pwuser && useradd -r -g pwuser -G audio,video pwuser \
    && mkdir -p /home/pwuser/Downloads \
    && chown -R pwuser:pwuser /home/pwuser

# Install front and others
RUN apt-get install -yq \
    ca-certificates \
    curl \
    dumb-init \
    ffmpeg \
    fontconfig \
    fonts-indic \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-thai-tlwg \
    gconf-service \
    libappindicator1 \
    libappindicator3-1 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgconf-2-4 \
    libgl1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
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
    libxt6 \
    libxtst6 \
    locales \
    lsb-release \
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

# Download Chrome
RUN cd /tmp && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] https://dl-ssl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' && \
    apt-get update && \
    apt-get install -yq google-chrome-stable

RUN apt-get -qq clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN mkdir /app

WORKDIR /app

COPY ./package.json /app

RUN npm install && \
    npm install -g ts-node typescript

COPY ./src /app/src

COPY ./extensions /app/extensions

COPY ./start.sh /app

COPY ./init.sh /app

RUN chown -R pwuser:pwuser /app

# Run everything after as non-privileged user.
USER pwuser

RUN ./init.sh

CMD ["./start.sh"]
