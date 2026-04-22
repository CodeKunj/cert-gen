import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import cors from "cors";
import express from "express";
import { formidable } from "formidable";

const require = createRequire(import.meta.url);
const libreoffice = require("libreoffice-convert");
const convertAsync = promisify(libreoffice.convert);

const app = express();
const port = Number(process.env.PORT || 8080);

app.use(cors());

function parseForm(req) {
  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: 25 * 1024 * 1024,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/convert", async (req, res) => {
  let uploaded;
  try {
    const { files } = await parseForm(req);
    const file = files.file;
    uploaded = Array.isArray(file) ? file[0] : file;

    if (!uploaded) {
      res.status(400).type("text/plain").send("Missing DOCX file.");
      return;
    }

    const docxBuffer = await fs.readFile(uploaded.filepath);
    const pdfBuffer = await convertAsync(docxBuffer, ".pdf", undefined);

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    const message = String(err?.message || err || "Conversion failed.");
    const missingLibreOffice = /soffice|libreoffice|spawn/i.test(message);

    if (missingLibreOffice) {
      res
        .status(503)
        .type("text/plain")
        .send(
          "PDF conversion engine is unavailable on this server. Install LibreOffice (soffice) on the host and retry."
        );
      return;
    }

    res.status(500).type("text/plain").send("PDF conversion failed: " + message);
  } finally {
    if (uploaded?.filepath) {
      await fs.unlink(uploaded.filepath).catch(() => {});
    }
  }
});

app.listen(port, () => {
  console.log(`Converter service listening on :${port}`);
});
