# FK Sava — sajt + CMS V2 (GitHub + Render)

Ovaj paket ima dve celine:

1. **Javni sajt (GitHub Pages)** — `index.html`, `club-data.json`, `assets/...`
2. **Admin CMS** — `admin.html` + mali bezbedni Node API u folderu `server/`

## Šta sada radi

- Godišta 2011–2020.
- Klik na godište otvara **Igrači / Utakmice / Galerija** u istom drawer-u.
- Utakmice imaju status: najavljena / odigrana / odložena.
- Rezultat FK Sava se računa iz liste golova.
- Gol sadrži minut, strelca i opcionog asistenta.
- Nastupi, golovi i asistencije igrača računaju se automatski iz utakmica.
- Klik na utakmicu prikazuje rezultat, strelce i YouTube video ako je upisan.
- Galerija može biti vezana za konkretno godište.
- Admin može da dodaje/menja igrače, utakmice i galeriju.
- Admin može da uploaduje JPG/PNG/WEBP direktno u GitHub repo.
- Dugme **Objavi promene** direktno menja `club-data.json` u GitHub repozitorijumu.
- GitHub token nikada nije u javnom sajtu ili browser kodu — nalazi se samo kao Render Environment Variable.

## Public data

Javni sajt prvo učitava `club-data.json` sa GitHub Pages. `assets/js/data.js` je samo fallback za lokalno otvaranje preko `file://`.

## Jednokratno podešavanje CMS V2

### 1. GitHub token

Na GitHub nalogu koji poseduje `websolutions-demo/FK_Sava` napravi **fine-grained personal access token** ograničen samo na repo `FK_Sava` sa dozvolom:

- Repository permissions → **Contents: Read and write**

Token se NE upisuje u HTML/JS.

### 2. Render API

Repo već sadrži `render.yaml`. Na Render-u može Blueprint ili običan Web Service:

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check: `/health`

Environment:

- `GITHUB_OWNER=websolutions-demo`
- `GITHUB_REPO=FK_Sava`
- `GITHUB_BRANCH=main`
- `GITHUB_DATA_PATH=club-data.json`
- `GITHUB_TOKEN=<fine-grained token>`
- `ADMIN_PASSWORD=<lozinka za klub>`
- `SESSION_SECRET=<dugačak slučajan string>`
- `ALLOWED_ORIGINS=https://websolutions-demo.github.io`

Za lokalno testiranje možeš ostaviti vrednost iz `.env.example` koja uključuje localhost.

### 3. Admin

Otvori:

`https://websolutions-demo.github.io/FK_Sava/admin.html`

Prvi put unesi Render API URL, npr:

`https://fk-sava-admin-api.onrender.com`

Browser pamti samo API URL. Admin lozinka se ne čuva u localStorage-u. Sesija traje do 12 sati u sessionStorage-u.

## Tok rada

1. Izaberi godište.
2. Dodaj igrače.
3. Dodaj utakmicu.
4. Kod odigrane utakmice označi sastav.
5. Dodaj svaki gol: minut + strelac + asistencija.
6. `Golovi FK Sava` = broj unetih golova; rezultat protivnika se unosi ručno.
7. Klikni **Objavi promene**.
8. API pravi commit u GitHub-u; GitHub Pages nakon svog deploy-a prikazuje nove podatke.

## Privatnost maloletnika

U javni deo unositi samo podatke koje klub/roditelji odobre (npr. ime, broj, pozicija, sportska statistika i fotografija). Ne unositi datum rođenja, školu, adresu ili druge privatne podatke.
