"""
Gunicorn config for production (Render, Heroku, etc.).

Keji backend uses Eventlet for WebSockets; this app is plain Flask + HTTP only,
so we use the default sync worker (no eventlet / no extra monkey-patching).
"""

import os

port = os.environ.get("PORT", "5000")
bind = f"0.0.0.0:{port}"
backlog = 2048

# Render free tier: 1 worker is typical; override with WEB_CONCURRENCY if you scale up.
workers = max(1, int(os.environ.get("WEB_CONCURRENCY", "1")))
worker_class = "sync"
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "120"))
graceful_timeout = 30
keepalive = 5

accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

proc_name = "halorai_backend"

daemon = False
pidfile = None


def when_ready(server):
  server.log.info("Gunicorn ready — workers=%s class=%s bind=%s", workers, worker_class, bind)
