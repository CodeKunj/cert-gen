import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import DropZone from "./components/DropZone";
import ProgressCard from "./components/ProgressCard";
import "./App.css";

function replaceInXml(xml, placeholder, value) {
  const safe = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const esc = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  xml = xml.replace(new RegExp(esc, "g"), safe);
  const frag = placeholder
    .split("")
    .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:<[^>]+>)*")
    .join("");
  return xml.replace(new RegExp(frag, "g"), safe);
}

export default function App() {
  const [docxFile, setDocxFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedCol, setSelectedCol] = useState("");
  const [placeholder, setPlaceholder] = useState("{{NAME}}");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  const handleExcel = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!data.length) { setError("Excel file is empty."); return; }
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
    setProgress({ pct: 0, msg: "Reading template…", done: false });

    const templateBytes = await docxFile.arrayBuffer();
    const outZip = new JSZip();

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const pct = 10 + (i / names.length) * 85;
      setProgress({ pct, msg: `Generating ${i + 1}/${names.length}: ${name}`, done: false });

      const docZip = await JSZip.loadAsync(templateBytes);
      const xmlFiles = Object.keys(docZip.files).filter(
        (n) => n.endsWith(".xml") || n.endsWith(".rels")
      );

      for (const xmlName of xmlFiles) {
        const content = await docZip.files[xmlName].async("string");
        if (content.includes(placeholder)) {
          docZip.file(xmlName, replaceInXml(content, placeholder, name));
        }
      }

      const blob = await docZip.generateAsync({ type: "blob" });
      const safe =
        name.replace(/[^a-zA-Z0-9 _\-]/g, "").replace(/\s+/g, "_") ||
        "cert_" + (i + 1);
      outZip.file(safe + ".docx", blob);
      await new Promise((r) => setTimeout(r, 0));
    }

    setProgress({ pct: 97, msg: "Creating ZIP…", done: false });
    const zipBlob = await outZip.generateAsync({ type: "blob" });
    setProgress({
      pct: 100,
      msg: `${names.length} certificate${names.length !== 1 ? "s" : ""} generated!`,
      done: true,
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = "certificates.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="badge">
          <span className="badge-dot" />
          Certificate Generator
        </div>
        <h1>Cert&thinsp;/&thinsp;Gen</h1>
        <p className="sub">
          Upload template &amp; student list — download a ZIP of filled certificates
        </p>
      </header>

      <main>
        {/* Step 1 */}
        <div className="step-card active">
          <div className="step-num">01 — Upload Files</div>
          <div className="drop-row">
            <DropZone
              accept=".docx"
              iconColor="#3b82f6"
              iconBg="#dbeafe"
              title="Certificate Template (.docx)"
              hint="Drop your Word template here or click to browse"
              filled={!!docxFile}
              fileName={docxFile?.name}
              onFile={(f) => { setDocxFile(f); setError(""); }}
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

        {/* Step 2 */}
        <div className="step-card">
          <div className="step-num">02 — Settings</div>
          <div className="settings-row">
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
                    <option key={c} value={c}>{c}</option>
                  ))
                )}
              </select>
              <span className="field-hint">Column containing student names</span>
            </div>
          </div>

          {names.length > 0 && (
            <div className="preview-pill">
              <span>{names.length} student{names.length !== 1 ? "s" : ""} —&nbsp;</span>
              <span className="preview-names">
                {names.slice(0, 3).join(", ")}{names.length > 3 ? " …" : ""}
              </span>
            </div>
          )}
        </div>

        {error && <div className="error-card">{error}</div>}

        <button className="btn-gen" disabled={!canGenerate} onClick={generate}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Generate &amp; Download ZIP
        </button>

        {progress && <ProgressCard progress={progress} />}
      </main>

      <footer>
        All processing happens in your browser — no data is uploaded anywhere.
      </footer>
    </div>
  );
}
