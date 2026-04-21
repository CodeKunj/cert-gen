export default function ProgressCard({ progress }) {
  return (
    <div className="progress-wrap">
      <div className="prog-row">
        <span className="prog-msg">{progress.msg}</span>
        <span className="prog-pct">{Math.round(progress.pct)}%</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: progress.pct + "%" }} />
      </div>
      {progress.done && (
        <div className="done-note">
          ✓ Download started — check your downloads folder
        </div>
      )}
    </div>
  );
}
