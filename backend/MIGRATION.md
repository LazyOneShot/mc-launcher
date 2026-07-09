# Migration — Multi-server support

Also drops the old broken default_server_ip/port columns if they exist.

```bash
sudo docker compose exec api python -c "
import sqlite3
conn = sqlite3.connect('/app/mc_launcher.db')
conn.execute('''
CREATE TABLE IF NOT EXISTS modpackserver (
    id VARCHAR PRIMARY KEY NOT NULL,
    pack_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    host VARCHAR NOT NULL,
    port INTEGER NOT NULL DEFAULT 25565,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (pack_id) REFERENCES modpack (id)
)
''')
try:
    conn.execute('ALTER TABLE modpack DROP COLUMN default_server_ip')
    conn.execute('ALTER TABLE modpack DROP COLUMN default_server_port')
    print('Dropped old default_server columns')
except Exception as e:
    print(f'Old columns already gone or drop unsupported: {e}')
conn.commit()
print('Migration complete')
"
sudo docker compose restart api
```

## Register the new route in main.py

Edit `/opt/mc-launcher/backend/app/main.py`:

1. Add import near top:
```python
from app.routes import servers
```

2. Register router:
```python
app.include_router(servers.router)
```
