leroy-merlin parser

first run:

create .env from .env.example template, and fill it
```bash
python -m venv venv
source venv/bin/activate
pip install selenium
sudo cp chromedriver /usr/local/bin/ # or add it to path manually
docker compose up -d
prisma migrate dev
npm start
```

non-first runs:
```bash
docker compose up -d # if not up
source venv/bin/activate
npm start
```
