# Backend (FastAPI)

## Dev
```bash
cp .env.example .env   # fill in values
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Homelab deploy
```bash
docker compose up -d
```

## API docs
Visit http://localhost:8000/docs after starting.
