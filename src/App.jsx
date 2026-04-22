import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { renderAsync } from "docx-preview";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import DropZone from "./components/DropZone";
import ProgressCard from "./components/ProgressCard";
import "./App.css";

function replaceInXml(xml, placeholder, value) {
  const safe = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");

  const esc = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let replaced = false;

  xml = xml.replace(new RegExp(esc, "g"), () => {
    replaced = true;
    return safe;
  });

  const frag = placeholder
    .split("")
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:<[^>]+>)*")
    .join("");

  xml = xml.replace(new RegExp(frag, "g"), () => {
    replaced = true;
    return safe;
  });

  return { xml, replaced };
}

function sanitizeFileName(name, fallback) {
  return name.replace(/[^a-zA-Z0-9 _\-]/g, "").replace(/\s+/g, "_") || fallback;
}

function fitReplacementText(value, maxChars) {
  const text = String(value || "").trim();
  const n = Number(maxChars);
  if (!Number.isFinite(n) || n <= 0) {
    return text;
  }
  if (text.length <= n) {
    return text;
  }
  return text.slice(0, n).trimEnd();
}

async function createFilledDocxBlob(templateBytes, marker, name) {
  const docZip = await JSZip.loadAsync(templateBytes);
  const xmlFiles = Object.keys(docZip.files).filter(
    (n) => n.endsWith(".xml") || n.endsWith(".rels")
  );
  let foundAnyPlaceholder = false;

  for (const xmlName of xmlFiles) {
    const content = await docZip.files[xmlName].async("string");
    const result = replaceInXml(content, marker, name);
    if (result.replaced) {
      foundAnyPlaceholder = true;
      docZip.file(xmlName, result.xml);
    }
  }

  if (!foundAnyPlaceholder) {
    const err = new Error(
      `Placeholder \"${marker}\" was not found in template. Make sure it exactly matches the text inside the .docx file.`
    );
    err.code = "PLACEHOLDER_NOT_FOUND";
    throw err;
  }

  return docZip.generateAsync({ type: "blob" });
}

async function convertDocxBlobToPdfInBrowser(docxBlob) {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "max-content";
  host.style.background = "#ffffff";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  try {
    const docxBuffer = await docxBlob.arrayBuffer();
    await renderAsync(docxBuffer, host, undefined, {
      inWrapper: true,
      useBase64URL: true,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
    });

    const images = Array.from(host.querySelectorAll("img"));
    await Promise.all(
      images.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              })
      )
    );

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await new Promise((resolve) => setTimeout(resolve, 120));

    const pageNodes = host.querySelectorAll(".docx-page");
    const targets = pageNodes.length ? Array.from(pageNodes) : [host];
    let pdf = null;

    for (let i = 0; i < targets.length; i++) {
      const page = targets[i];
      const width = Math.ceil(page.scrollWidth || page.clientWidth || 1123);
      const height = Math.ceil(page.scrollHeight || page.clientHeight || 794);

      const originalBoxShadow = page.style.boxShadow;
      page.style.boxShadow = "none";

      const canvas = await html2canvas(page, {
        backgroundColor: "#ffffff",
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
        useCORS: true,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0,
      });

      page.style.boxShadow = originalBoxShadow;

      const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";

      if (!pdf) {
        pdf = new jsPDF({
          orientation,
          unit: "px",
          format: [canvas.width, canvas.height],
        });
      } else {
        pdf.addPage([canvas.width, canvas.height], orientation);
      }

      const imageData = canvas.toDataURL("image/png");
      pdf.addImage(imageData, "PNG", 0, 0, canvas.width, canvas.height);
    }

    if (!pdf) {
      throw new Error("Could not render DOCX page for browser PDF conversion.");
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(host);
  }
}

export default function App() {
  const [docxFile, setDocxFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedCol, setSelectedCol] = useState("");
  const [placeholder, setPlaceholder] = useState("{{NAME}}");
  const [maxChars, setMaxChars] = useState("");
  const [outputFormat, setOutputFormat] = useState("docx");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  const handleExcel = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!data.length) {
          setError("Excel file is empty.");
          return;
        }

        const cols = Object.keys(data[0]);
        setRows(data);
        setColumns(cols);
        setSelectedCol(cols[0]);
        setError("");
      } catch (err) {
        setError("Could not read Excel: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const names = rows.map((r) => String(r[selectedCol] || "").trim()).filter(Boolean);
  const canGenerate = docxFile && names.length > 0;

  const generate = async () => {
    setError("");
    const marker = placeholder.trim();
    if (!marker) {
      setError("Placeholder cannot be empty.");
      return;
    }

    try {
      setProgress({
        pct: 0,
        msg: outputFormat === "pdf" ? "Preparing PDF template..." : "Reading template...",
        done: false,
      });

      const templateBytes = await docxFile.arrayBuffer();
      const outZip = new JSZip();

      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const fittedName = fitReplacementText(name, maxChars);
        const pct = 10 + (i / names.length) * 85;
        setProgress({ pct, msg: `Generating ${i + 1}/${names.length}: ${name}`, done: false });

        const filledDocxBlob = await createFilledDocxBlob(templateBytes, marker, fittedName);
        const safe = sanitizeFileName(name, `cert_${i + 1}`);

        if (outputFormat === "pdf") {
          const pdfBlob = await convertDocxBlobToPdfInBrowser(filledDocxBlob);
          outZip.file(`${safe}.pdf`, pdfBlob);
        } else {
          outZip.file(`${safe}.docx`, filledDocxBlob);
        }

        await new Promise((r) => setTimeout(r, 0));
      }

      setProgress({ pct: 97, msg: "Creating ZIP...", done: false });
      const zipBlob = await outZip.generateAsync({ type: "blob" });
      setProgress({
        pct: 100,
        msg: `${names.length} certificate${names.length !== 1 ? "s" : ""} generated!`,
        done: true,
      });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = outputFormat === "pdf" ? "certificates-pdf.zip" : "certificates.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (err) {
      setProgress(null);
      if (err.code === "PLACEHOLDER_NOT_FOUND") {
        setError(err.message);
      } else {
        setError("Could not generate certificates: " + err.message);
      }
    }
  };

  return (
    <div className="app">
      <div className="live-bg" aria-hidden="true">
        <div className="aurora aurora-a" />
        <div className="aurora aurora-b" />
        <div className="grid-drift" />
      </div>

      <header className="header">
        <div className="badge">
          <span className="badge-dot" />
          Certificate Generator
        </div>
        <h1>Cert&thinsp;/&thinsp;Gen</h1>
        <p className="sub">
          Upload template &amp; student list - choose DOCX or PDF output for the finished certificates
        </p>
      </header>

      <main>
        <div className="step-card active">
          <div className="step-num">01 - Upload Files</div>
          <div className="drop-row">
            <DropZone
              accept=".docx"
              iconColor="#3b82f6"
              iconBg="#dbeafe"
              title="Certificate Template (.docx)"
              hint="Drop your Word template here or click to browse"
              filled={!!docxFile}
              fileName={docxFile?.name}
              onFile={(f) => {
                setDocxFile(f);
                setError("");
              }}
            />
            <DropZone
              accept=".xlsx,.xls"
              iconColor="#22c55e"
              iconBg="#dcfce7"
              title="Student List (.xlsx / .xls)"
              hint="Drop your Excel file here or click to browse"
              filled={rows.length > 0}
              fileName={rows.length > 0 ? `${rows.length} students loaded` : ""}
              onFile={handleExcel}
            />
          </div>
        </div>

        <div className="step-card">
          <div className="step-num">02 - Settings</div>
          <div className="settings-row">
            <div className="field">
              <label htmlFor="format-select">Output format</label>
              <select
                id="format-select"
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
              >
                <option value="docx">DOCX</option>
                <option value="pdf">PDF</option>
              </select>
              <span className="field-hint">Choose the file type for each certificate</span>
            </div>
            <div className="field">
              <label htmlFor="placeholder">Placeholder in template</label>
              <input
                id="placeholder"
                type="text"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="{{NAME}}"
              />
              <span className="field-hint">Text in your template to replace</span>
            </div>
            <div className="field">
              <label htmlFor="max-chars">Max characters (fit)</label>
              <input
                id="max-chars"
                type="number"
                min="1"
                step="1"
                value={maxChars}
                onChange={(e) => setMaxChars(e.target.value)}
                placeholder="Leave empty for full text"
              />
              <span className="field-hint">Trim replacement text so it fits fixed template space</span>
            </div>
            <div className="field">
              <label htmlFor="col-select">Name column</label>
              <select
                id="col-select"
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value)}
                disabled={!columns.length}
              >
                {columns.length === 0 ? (
                  <option>Upload Excel first</option>
                ) : (
                  columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                )}
              </select>
              <span className="field-hint">Column containing student names</span>
            </div>
          </div>

          {names.length > 0 && (
            <div className="preview-pill">
              <span>
                {names.length} student{names.length !== 1 ? "s" : ""} -&nbsp;
              </span>
              <span className="preview-names">
                {names.slice(0, 3).join(", ")}
                {names.length > 3 ? " ..." : ""}
              </span>
            </div>
          )}
        </div>

        {error && <div className="error-card">{error}</div>}

        <button className="btn-gen" disabled={!canGenerate} onClick={generate}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Generate &amp; Download {outputFormat.toUpperCase()} ZIP
        </button>

        {progress && <ProgressCard progress={progress} />}
      </main>

      <footer>
        DOCX and PDF are generated in your browser. PDF output is saved as a real .pdf file.
      </footer>
    </div>
  );
}
