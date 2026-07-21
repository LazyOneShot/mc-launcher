"""
Separate module so route files can import `limiter` for the @limiter.limit(...)
decorator without a circular import against main.py (which imports the route
modules, and needs the same limiter instance to attach to app.state).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
