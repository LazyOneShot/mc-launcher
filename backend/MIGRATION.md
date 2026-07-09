# Migration for v0.5.0

Adds `default_server_ip` and `default_server_port` columns to the `modpack` table.

## Option 1 — Nuke DB (fastest, wipes packs)
```bash
cd /opt/mc-launcher/backend
sudo docker compose down
sudo rm mc_launcher.db
sudo touch mc_launcher.db
sudo docker compose up -d --build
```

## Option 2 — In-place migration (keeps data)
```bash
sudo docker compose exec api sqlite3 /app/mc_launcher.db <<SQL
ALTER TABLE modpack ADD COLUMN default_server_ip TEXT DEFAULT '';
ALTER TABLE modpack ADD COLUMN default_server_port INTEGER DEFAULT 25565;
SQL
sudo docker compose restart api
```

Go with Option 2 if you have packs you want to keep.
