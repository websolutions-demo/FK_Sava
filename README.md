# FK Sava — V5 Sports Admin

Ovaj paket sadrži javni FK Sava sajt i mobilno prilagođen Sports Admin portal.

## Javni sajt

- igrači po godištima 2011–2020
- statistika iz odigranih utakmica
- rezultati i buduće utakmice
- lokacija terena + dugme za navigaciju
- YouTube video
- galerija po godištu

## Sports Admin

Otvori `admin.html`.

Admin može da:

- dodaje i menja igrače po godištima
- fotografiše/izabere sliku igrača na Android telefonu
- automatski cropuje sliku igrača na 3:4, resize-uje i kompresuje pre slanja
- unosi buduću utakmicu: datum, vreme, protivnik, takmičenje, teren, adresu, GPS/Google Maps link
- unosi završenu utakmicu: sastav, rezultat protivnika, strelce, minute i opcione asistencije
- doda YouTube link ili video ID
- doda naslovnu sliku utakmice, automatski crop 16:9
- dodaje više fotografija u galeriju odjednom; resize do 1600 px + WEBP kompresija
- objavi promene direktno u `club-data.json` na GitHub-u
- koristi lokalni draft ako browser/telefon zatvori portal pre objave
- izvozi/uvozi JSON backup

Statistika igrača se NE unosi ručno. Nastupi, golovi i asistencije računaju se iz odigranih utakmica.

## Render Admin API

Servis koristi folder `server/`.

Render podešavanja:

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check: `/health`

Environment:

- `GITHUB_OWNER=websolutions-demo`
- `GITHUB_REPO=FK_Sava`
- `GITHUB_BRANCH=main`
- `GITHUB_DATA_PATH=club-data.json`
- `GITHUB_TOKEN=<fine-grained token, Contents read/write samo za ovaj repo>`
- `ADMIN_PASSWORD=<lozinka za JR>`
- `SESSION_SECRET=<Render generated secret>`
- `ALLOWED_ORIGINS=https://websolutions-demo.github.io,http://localhost:8000,http://127.0.0.1:8000,null`

API token nikad nije u javnom HTML/JS kodu. GitHub token se čuva samo na Render-u.

## Test bez Render-a

Na login ekranu klikni `Otvori lokalni demo`. Admin tada učitava lokalni `club-data.json`; unos i obrada UI-ja rade, ali objavljivanje i upload na GitHub nisu dostupni.

Za lokalni statički test koristi npr. `python -m http.server 8000` u root folderu i otvori `http://localhost:8000/admin.html`.
