"""Read server-side demo settings without requiring shell exports."""
import os
from pathlib import Path
from urllib.parse import urlparse
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
# Explicit process variables win, then .env.demo, then existing .env.local.
load_dotenv(ROOT / '.env.demo', override=False)
load_dotenv(ROOT / '.env.local', override=False)


def database_settings():
    host = os.environ.get('SPACETIMEDB_HOST', '').strip().rstrip('/')
    database = os.environ.get('SPACETIMEDB_DATABASE', '').strip()
    if not host or not database:
        raise ValueError('Set SPACETIMEDB_HOST and SPACETIMEDB_DATABASE in .env.demo beside package.json')
    if host.startswith('wss://'): host = 'https://' + host[6:]
    elif host.startswith('ws://'): host = 'http://' + host[5:]
    parsed = urlparse(host)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError('SPACETIMEDB_HOST must be the database server HTTP(S) or WS(S) base URL')
    if parsed.path not in {'', '/'} or parsed.query or parsed.fragment:
        raise ValueError('SPACETIMEDB_HOST must be a server base URL, not a console or database-page URL')
    return host, database


def connection_error(exc):
    import httpx
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status in (401, 403):
            return 'SpacetimeDB denied access. Check the token or remove an invalid token for the public table.'
        if status == 404:
            return 'SpacetimeDB returned 404. Check the server host, database name, and published menu_waste module.'
        if status == 400:
            return 'SpacetimeDB rejected the SQL query. Confirm that the supplied index.ts is published with the menu_waste table.'
        return f'SpacetimeDB returned HTTP {status}. Inspect the FastAPI terminal for details.'
    if isinstance(exc, httpx.RequestError):
        return 'Cannot reach SpacetimeDB. Check SPACETIMEDB_HOST and the network connection.'
    return str(exc) or 'Invalid SpacetimeDB configuration or row data.'
