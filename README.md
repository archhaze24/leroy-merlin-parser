# leroy-merlin-parser

## first run:

create .env from .env.example template, and fill it
```bash
python -m venv venv
source venv/bin/activate # in more recent python versions it can be venv/Scripts/activate
pip install selenium
sudo cp chromedriver /usr/local/bin/ # or add it to path manually
docker compose up -d
npm i
npx prisma migrate dev
npm start
```

## non-first runs:
```bash
docker compose up -d # if not up
source venv/bin/activate
npm start
```

## troubleshooting:

#### the python script can't get qrator_jsid, or the website doesn't accept it
check that chromedriver version matches the one specified in qrator_jsid.py
also check that puppeteer user agent matches the one in chromedriver

#### i get a lot of errors saying that something is undefined
the website has probably banned you for some time (10-15 minutes)