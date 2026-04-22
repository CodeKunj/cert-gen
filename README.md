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

### Plain Node run

```bash
cd converter-service
npm install
npm start
```

Runs on `http://localhost:8080` by default if LibreOffice is installed on the host.

### Frontend env

In the app root, set:

`VITE_CONVERTER_API_URL=https://your-converter-host/convert`

Then run the frontend with `npm run dev` or rebuild for production.

## Notes

- DOCX output remains browser-generated and exact to your template.
- PDF output is server-generated when converter service is available.
- If converter is unreachable, app falls back to browser PDF with a warning.
