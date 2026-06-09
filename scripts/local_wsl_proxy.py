#!/usr/bin/env python3

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


TARGET = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8000"
LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
UPSTREAM_TIMEOUT_SECONDS = 1800


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        self._proxy()

    def do_POST(self):
        self._proxy()

    def _proxy(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else None
        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in {"host", "connection", "content-length"}
        }
        request = Request(
            f"{TARGET}{self.path}",
            data=body,
            headers=headers,
            method=self.command,
        )

        try:
            response = urlopen(request, timeout=UPSTREAM_TIMEOUT_SECONDS)
        except HTTPError as error:
            response = error
        except (TimeoutError, URLError) as error:
            payload = json.dumps(
                {
                    "detail": (
                        "The local NLP pipeline did not finish before the proxy timeout. "
                        "The request may still be processing in WSL. Try a shorter passage "
                        "or wait for the current generation to finish."
                    ),
                    "proxy_error": str(error),
                }
            ).encode("utf-8")
            self.send_response(504)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)
            return

        payload = response.read()
        self.send_response(response.status)
        for key, value in response.headers.items():
            if key.lower() not in {"connection", "content-length", "transfer-encoding"}:
                self.send_header(key, value)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), ProxyHandler)
    print(f"Proxying http://{LISTEN_HOST}:{LISTEN_PORT} to {TARGET}", flush=True)
    server.serve_forever()
