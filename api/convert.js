import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { formidable } from "formidable";

const require = createRequire(import.meta.url);
const libreoffice = require("libreoffice-convert");
const convertAsync = promisify(libreoffice.convert);

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return;
  }

  let uploaded;
  try {
    const { files } = await parseForm(req);
    const file = files.file;
    uploaded = Array.isArray(file) ? file[0] : file;

    if (!uploaded) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Missing DOCX file.");
      return;
    }

    const docxBuffer = await fs.readFile(uploaded.filepath);
    const pdfBuffer = await convertAsync(docxBuffer, ".pdf", undefined);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    res.end(pdfBuffer);
  } catch (err) {
    const message = String(err?.message || err || "Conversion failed.");
    const missingLibreOffice = /soffice|libreoffice|spawn/i.test(message);

    res.statusCode = missingLibreOffice ? 503 : 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    if (missingLibreOffice) {
      res.end(
        "PDF conversion engine is unavailable on this server. Install LibreOffice (soffice) on the host and retry."
      );
      return;
    }
    res.end("PDF conversion failed: " + message);
  } finally {
    if (uploaded?.filepath) {
      await fs.unlink(uploaded.filepath).catch(() => {});
    }
  }
}
