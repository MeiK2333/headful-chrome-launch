mitmdump -p 8081 &
mitmdump --mode upstream:http://127.0.0.1:8081 -s proxy.py --ssl-insecure --no-http2
