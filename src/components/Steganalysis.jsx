import { useState, useRef, useCallback, useEffect } from 'react';
import { extractBitPlanes, chiSquareAnalysis, generateHistogram, visualAttack } from '../utils/analysis';
import { Upload, CheckCircle, XCircle, AlertTriangle, Grid, BarChart, Eye, Crosshair, Info } from './Icons';

export default function Steganalysis() {
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState('bitplane');
  const [bitPlanes, setBitPlanes] = useState([]);
  const [chiResults, setChiResults] = useState(null);
  const [histogram, setHistogram] = useState(null);
  const [visualAttackData, setVisualAttackData] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState('r');
  const [status, setStatus] = useState(null);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const visualAttackCanvasRef = useRef(null);

  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      setStatus({ type: 'error', text: 'Please upload a valid image file.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setBitPlanes([]);
        setChiResults(null);
        setHistogram(null);
        setVisualAttackData(null);
        setStatus(null);

        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        setImageData(canvas.getContext('2d').getImageData(0, 0, img.width, img.height));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    loadImage(e.dataTransfer.files[0]);
  }, [loadImage]);

  const runBitPlaneAnalysis = () => {
    if (!imageData) return;
    setStatus({ type: 'success', text: 'Extracting bit planes...' });
    setTimeout(() => {
      const planes = extractBitPlanes(imageData, selectedChannel);
      setBitPlanes(planes);
      setStatus({ type: 'success', text: `Extracted ${planes.length} bit planes for the ${selectedChannel.toUpperCase()} channel.` });
    }, 50);
  };

  const runChiSquare = () => {
    if (!imageData) return;
    setStatus({ type: 'success', text: 'Running chi-square analysis...' });
    setTimeout(() => {
      const results = chiSquareAnalysis(imageData);
      setChiResults(results);
      setStatus({
        type: results.isSuspicious ? 'warning' : 'success',
        text: results.confidence,
      });
    }, 50);
  };

  const runHistogram = () => {
    if (!imageData) return;
    setHistogram(generateHistogram(imageData));
    setStatus({ type: 'success', text: 'Histogram generated for all channels.' });
  };

  const runVisualAttack = () => {
    if (!imageData) return;
    setVisualAttackData(visualAttack(imageData));
    setStatus({ type: 'success', text: 'Visual attack applied — LSB values amplified to full range.' });
  };

  useEffect(() => {
    if (visualAttackData && visualAttackCanvasRef.current) {
      const canvas = visualAttackCanvasRef.current;
      canvas.width = visualAttackData.width;
      canvas.height = visualAttackData.height;
      canvas.getContext('2d').putImageData(visualAttackData, 0, 0);
    }
  }, [visualAttackData]);

  const renderHistogramBars = (data, color) => {
    const max = Math.max(...data);
    return (
      <div className="histogram-container">
        {data.map((val, i) => (
          <div
            key={i}
            className="histogram-bar"
            style={{
              height: `${(val / max) * 100}%`,
              background: color,
            }}
            title={`Value ${i}: ${val}`}
          />
        ))}
      </div>
    );
  };

  const analysisTabs = [
    { id: 'bitplane', label: 'Bit Planes', Icon: Grid },
    { id: 'chi', label: 'Chi-Square', Icon: Crosshair },
    { id: 'histogram', label: 'Histogram', Icon: BarChart },
    { id: 'visual', label: 'Visual Attack', Icon: Eye },
  ];

  return (
    <div className="tool-section fade-in-up">
      <div className="tool-header">
        <h2>Steganalysis</h2>
        <p>Detect hidden payloads in images through statistical analysis, bit plane extraction, and visual attacks.</p>
      </div>

      <div className="glass-card">
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {image ? (
            <canvas ref={canvasRef} className="drop-zone-preview" />
          ) : (
            <>
              <div className="drop-zone-icon"><Upload size={32} /></div>
              <p className="drop-zone-text">Drop an image to analyze</p>
              <p className="drop-zone-hint">Upload a suspicious image to scan for hidden data</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => loadImage(e.target.files[0])}
          />
        </div>

        {image && (
          <>
            <div className="toggle-group" style={{ marginTop: 'var(--space-lg)' }}>
              {analysisTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`toggle-option ${activeAnalysis === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveAnalysis(tab.id)}
                >
                  <tab.Icon size={14} /> {tab.label}
                </button>
              ))}
            </div>

            {/* Bit Planes */}
            {activeAnalysis === 'bitplane' && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                  <div className="input-group" style={{ margin: 0, flex: 1 }}>
                    <select className="select-field" value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)}>
                      <option value="r">Red channel</option>
                      <option value="g">Green channel</option>
                      <option value="b">Blue channel</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={runBitPlaneAnalysis}>
                    <Grid size={15} /> Extract
                  </button>
                </div>

                {bitPlanes.length > 0 && (
                  <div className="bitplane-grid">
                    {bitPlanes.map((plane, i) => (
                      <div key={i} className="bitplane-item">
                        <canvas
                          ref={(el) => {
                            if (el) {
                              el.width = plane.imageData.width;
                              el.height = plane.imageData.height;
                              el.getContext('2d').putImageData(plane.imageData, 0, 0);
                            }
                          }}
                        />
                        <p>{plane.name}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="explainer-box">
                  <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    The LSB (Bit 0) plane should look like random noise in a clean image.
                    Visible patterns or structured data in this plane indicate hidden content.
                  </span>
                </div>
              </div>
            )}

            {/* Chi-Square */}
            {activeAnalysis === 'chi' && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <button className="btn btn-primary" onClick={runChiSquare} style={{ marginBottom: 'var(--space-lg)' }}>
                  <Crosshair size={15} /> Run test
                </button>

                {chiResults && (
                  <div>
                    <table className="metadata-table">
                      <thead>
                        <tr>
                          <th>Channel</th>
                          <th>χ² Statistic</th>
                          <th>p-value</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chiResults.channels.map((ch, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'var(--font-body)' }}>{ch.channel}</td>
                            <td>{ch.chiSquare}</td>
                            <td>{ch.pValue}</td>
                            <td style={{ color: ch.suspicious ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                              {ch.suspicious ? 'Suspicious' : 'Clean'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className={`info-bar ${chiResults.isSuspicious ? 'warning' : 'success'}`} style={{ marginTop: 'var(--space-md)' }}>
                      {chiResults.isSuspicious ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                      {chiResults.confidence}
                    </div>
                  </div>
                )}

                <div className="explainer-box">
                  <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    Tests whether LSB pair distributions are uniform. In natural images, adjacent
                    values (2i, 2i+1) have varying frequencies. LSB embedding makes them uniform, yielding
                    a p-value close to 1.0.
                  </span>
                </div>
              </div>
            )}

            {/* Histogram */}
            {activeAnalysis === 'histogram' && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <button className="btn btn-primary" onClick={runHistogram} style={{ marginBottom: 'var(--space-lg)' }}>
                  <BarChart size={15} /> Generate
                </button>

                {histogram && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                    <div>
                      <label className="input-label" style={{ color: '#ef4444' }}>Red</label>
                      {renderHistogramBars(histogram.red, '#ef4444')}
                    </div>
                    <div>
                      <label className="input-label" style={{ color: '#22c55e' }}>Green</label>
                      {renderHistogramBars(histogram.green, '#22c55e')}
                    </div>
                    <div>
                      <label className="input-label" style={{ color: '#3b82f6' }}>Blue</label>
                      {renderHistogramBars(histogram.blue, '#3b82f6')}
                    </div>
                    <div>
                      <label className="input-label" style={{ color: '#94a3b8' }}>Luminance</label>
                      {renderHistogramBars(histogram.luminance, '#94a3b8')}
                    </div>
                  </div>
                )}

                <div className="explainer-box">
                  <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    LSB steganography flattens adjacent value pairs, creating a &quot;comb&quot; pattern
                    where values 2i and 2i+1 have nearly identical frequencies.
                  </span>
                </div>
              </div>
            )}

            {/* Visual Attack */}
            {activeAnalysis === 'visual' && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <button className="btn btn-primary" onClick={runVisualAttack} style={{ marginBottom: 'var(--space-lg)' }}>
                  <Eye size={15} /> Apply attack
                </button>

                {visualAttackData && (
                  <div className="comparison-grid">
                    <div className="comparison-panel">
                      <h4>Original</h4>
                      <canvas
                        ref={(el) => {
                          if (el && image) {
                            el.width = image.width;
                            el.height = image.height;
                            el.getContext('2d').drawImage(image, 0, 0);
                          }
                        }}
                        style={{ maxWidth: '100%', maxHeight: '280px' }}
                      />
                    </div>
                    <div className="comparison-panel">
                      <h4>LSB Amplified</h4>
                      <canvas
                        ref={visualAttackCanvasRef}
                        style={{ maxWidth: '100%', maxHeight: '280px' }}
                      />
                    </div>
                  </div>
                )}

                <div className="explainer-box">
                  <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    Extracts each pixel's LSB and maps it to full intensity. A clean image shows
                    structured noise. Embedded data appears as random noise in the affected regions.
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {status && (
          <div className={`info-bar ${status.type}`} style={{ marginTop: 'var(--space-md)' }}>
            {status.type === 'success' ? <CheckCircle size={14} /> : status.type === 'warning' ? <AlertTriangle size={14} /> : <XCircle size={14} />}
            {status.text}
          </div>
        )}
      </div>
    </div>
  );
}
