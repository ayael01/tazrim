import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const VIDEO_PATH = "/videos/tazrim-product-demo.mp4";

export default function ProductVideo() {
  const navigate = useNavigate();
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const scenes = useMemo(
    () => [
      "Overview dashboard with yearly snapshot",
      "Bank activities flow: upload, categorize, and review",
      "Credit card trends: category and merchant reports",
      "Drill-down details and category reassignment",
      "Excel export workflow for bank and card reports",
    ],
    []
  );

  return (
    <div className="report-page">
      <header className="page-header">
        <div>
          <h1>Product video</h1>
          <p>Tazrim walkthrough and key user flows in one timeline.</p>
        </div>
        <button className="ghost-button" onClick={() => navigate("/")}>
          Back to main product
        </button>
      </header>

      <section className="card report-card video-card">
        <div className="card-header">
          <h3>Tazrim demo</h3>
          <p>File path: {VIDEO_PATH}</p>
        </div>
        <div className="video-stage">
          <video
            className="product-video"
            controls
            preload="metadata"
            onLoadedData={() => {
              setVideoReady(true);
              setVideoError(false);
            }}
            onError={() => {
              setVideoReady(false);
              setVideoError(true);
            }}
          >
            <source src={VIDEO_PATH} type="video/mp4" />
          </video>
          {!videoReady && !videoError && (
            <div className="video-overlay">Loading video preview...</div>
          )}
          {videoError && (
            <div className="video-overlay error">
              Video not found. Put your rendered MP4 at{" "}
              <code>frontend/public/videos/tazrim-product-demo.mp4</code>.
            </div>
          )}
        </div>
      </section>

      <section className="card report-card">
        <div className="card-header">
          <h3>Recommended sequence</h3>
          <p>Suggested sections for a clear product narrative</p>
        </div>
        <ol className="video-scene-list">
          {scenes.map((scene) => (
            <li key={scene}>{scene}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
