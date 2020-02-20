FROM python:3.8.0-buster

RUN pip install -i https://mirrors.aliyun.com/pypi/simple/ mitmproxy

COPY . /app

WORKDIR /app

CMD ["./proxy.sh"]
