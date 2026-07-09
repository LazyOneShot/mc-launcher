# Update main.py

In `/opt/mc-launcher/backend/app/main.py`, add:

1. New import near the top with other route imports:
```python
from app.routes import servers
```

2. Register the router near the other `app.include_router(...)` lines:
```python
app.include_router(servers.router)
```
