# Restoring /opt/mc-launcher/backend

These three files were reconstructed from the Docker build log and `docker ps`
output — they are **not** the originals. `requirements.txt` in particular is a
guess at the package set; the exact pinned versions are recoverable from the
still-running container:

```bash
docker exec backend-api-1 pip freeze > requirements.txt
```

Do that instead of trusting the file in this zip, if the container is still up.

## Order of operations

The container currently holds the only copies of three things. Restarting it
loses all three. Rescue them first.

### 1. The database (already done if you ran the /proc copy)

```bash
sudo cp /proc/$(sudo docker inspect --format '{{.State.Pid}}' backend-api-1)/fd/11 ~/mc_launcher.db.rescued
```

### 2. The environment

`.env` was deleted from the host, but the container has it loaded:

```bash
sudo docker exec backend-api-1 env | grep -E 'MINIO|JWT|DATABASE|MS_CLIENT|AZURE'
```

Write those to `/opt/mc-launcher/backend/.env`, one `KEY=value` per line.
Check for stray Docker-injected vars (PATH, HOSTNAME) before saving.

Note: `MINIO_SECRET_KEY` must not be quoted and must not contain `#`.

### 3. Exact dependencies

```bash
sudo docker exec backend-api-1 pip freeze > ~/requirements.rescued.txt
```

## Then restore

```bash
cp ~/requirements.rescued.txt /opt/mc-launcher/backend/requirements.txt
cp ~/mc_launcher.db.rescued  /opt/mc-launcher/backend/mc_launcher.db

cd /opt/mc-launcher/backend
ls -l   # Dockerfile, docker-compose.yml, requirements.txt, .env, mc_launcher.db, app/

sudo docker compose down
sudo docker compose up -d --build
sudo docker compose logs -f api
```

Wait for `Application startup complete.`

## Verify

```bash
curl -s https://mc-api.daboismc.win/health
curl -s https://mc-api.daboismc.win/openapi.json \
  | python3 -c "import sys,json; p=json.load(sys.stdin)['paths']; [print(k) for k in p if 'audit' in k or 'update' in k]"
```

Then in the launcher, open a pack — 5 packs and 133 mods should still be there.
