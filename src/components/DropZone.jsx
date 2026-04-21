import { useState, useRef, useCallback } from "react";

export default function DropZone({ accept, iconColor, iconBg, title, hint, filled, fileName, onFile }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  const cls = ["drop-area", over ? "over" : "", filled ? "filled" : ""].filter(Boolean).join(" ");

  return (
    <div
      className={cls}
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        ref={inputRef}
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }}
      />
      <div className="file-icon" style={{ background: iconBg }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <div className="drop-info">
        <div className="drop-title">{title}</div>
        {!filled
          ? <div className="drop-hint">{hint}</div>
          : <div className="drop-file">{fileName}</div>
        }
      </div>
      {filled && (
        <div className="check-circle">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#f7f5f0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 6 5 9 10 3"/>
          </svg>
        </div>
      )}
    </div>
  );
}
