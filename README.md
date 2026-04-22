# BulkCertify

## Why you saw the PDF engine warning

Your frontend is hosted on a serverless environment where LibreOffice is not available.
Because of that, `/api/convert` cannot do exact DOCX-to-PDF conversion and the app falls back to browser PDF rendering.

## Exact template-accurate PDF setup

Deploy the included LibreOffice converter service from `converter-service/` to a host that supports Docker (Render, Railway, Fly.io, VPS, etc.).

### 1. Deploy converter service

Build from folder: `converter-service/`

Service endpoint after deploy:
- Health: `https://your-converter-host/health`
- Convert: `https://your-converter-host/convert`

### 2. Configure frontend

Create `.env` in the app root from `.env.example` and set:

`VITE_CONVERTER_API_URL=https://your-converter-host/convert`

Then rebuild/redeploy frontend.

## Local run for converter service

### Full app with Docker Compose

From the repo root:

```bash
docker compose up --build
```

This starts both services:
- Frontend on `http://localhost:5173`
- Converter on `http://localhost:8080`

The frontend is already configured inside Compose to call the converter service by container name.

### Docker Compose

From the `converter-service/` folder:

```bash
docker compose up --build
```

This starts the exact PDF converter on `http://localhost:8080`.

### Frontend env for local testing

In the app root, set:

`VITE_CONVERTER_API_URL=http://localhost:8080/convert`

Then run the frontend with `npm run dev`.

### Plain Node run

```bash
cd converter-service
npm install
npm start
```

Runs on `http://localhost:8080` by default.

## Notes

- DOCX output remains browser-generated and exact to your template.
- PDF output is server-generated when converter service is available.
- If converter is unreachable, app falls back to browser PDF with a warning.
