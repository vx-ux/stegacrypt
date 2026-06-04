import { useState, useRef, useCallback, useEffect } from 'react';
import { extractMetadata, stripMetadata, detectFormat } from '../utils/metadata';
import { Upload, CheckCircle, XCircle, AlertTriangle, MapPin, Info, Trash2, Download, Files } from './Icons';

export default function MetadataViewer() {
  const [results, setResults] = useState([]); // Array of { fileName, fileSize, format, fields, gps, buffer }
  const [activeIndex, setActiveIndex] = useState(0);
  const [imagePreview, setImagePreview] = useState(null);
  const [status, setStatus] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isStripping, setIsStripping] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  const processFiles = useCallback(async (files) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    if (imagePreview) URL.revokeObjectURL(imagePreview);

    const newResults = [];
    let errorCount = 0;

    for (const file of fileArray) {
      if (file.size > 20 * 1024 * 1024) {
        errorCount++;
        continue;
      }

      try {
        const buffer = await file.arrayBuffer();
        const meta = extractMetadata(buffer, file.name);

        newResults.push({
          fileName: file.name,
          fileSize: file.size,
          format: meta.format,
          fields: meta.fields,
          gps: meta.gps,
          buffer,
          mimeType: file.type,
        });
      } catch (err) {
        newResults.push({
          fileName: file.name,
          fileSize: file.size,
          format: 'Error',
          fields: [{ label: 'Error', value: err.message }],
          gps: null,
          buffer: null,
          mimeType: file.type,
        });
      }
    }

    setResults(newResults);
    setActiveIndex(0);

    // Generate preview for first image
    if (newResults.length > 0 && newResults[0].mimeType?.startsWith('image/')) {
      const blob = new Blob([newResults[0].buffer], { type: newResults[0].mimeType });
      setImagePreview(URL.createObjectURL(blob));
    } else {
      setImagePreview(null);
    }

    const metaCount = newResults.reduce((sum, r) => sum + r.fields.length - 3, 0); // subtract file info fields
    if (errorCount > 0) {
      setStatus({ type: 'warning', text: `Processed ${newResults.length} file(s). ${errorCount} skipped (over 20MB).` });
    } else if (metaCount > 0) {
      setStatus({ type: 'success', text: `Extracted metadata from ${newResults.length} file(s). ${metaCount} total fields found.` });
    } else {
      setStatus({ type: 'warning', text: 'No metadata found. Files may have been stripped.' });
    }
  }, [imagePreview]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleStrip = async () => {
    const active = results[activeIndex];
    if (!active?.buffer) return;

    setIsStripping(true);
    try {
      const format = detectFormat(active.buffer);
      const cleaned = stripMetadata(active.buffer, format);

      const ext = active.fileName.split('.').pop();
      const cleanName = active.fileName.replace(`.${ext}`, `_clean.${ext}`);

      const blob = new Blob([cleaned]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = cleanName;
      link.click();
      URL.revokeObjectURL(url);

      setStatus({ type: 'success', text: `Saved cleaned copy: ${cleanName} (${formatFileSize(cleaned.byteLength)})` });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setIsStripping(false);
    }
  };

  const handleTabClick = (index) => {
    setActiveIndex(index);
    if (results[index]?.mimeType?.startsWith('image/') && results[index]?.buffer) {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      const blob = new Blob([results[index].buffer], { type: results[index].mimeType });
      setImagePreview(URL.createObjectURL(blob));
    } else {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const activeResult = results[activeIndex];
  const canStrip = activeResult?.format === 'JPEG' || activeResult?.format === 'PNG';

  const FORMAT_COLORS = {
    JPEG: '#f59e0b',
    PNG: '#06b6d4',
    GIF: '#8b5cf6',
    BMP: '#ef4444',
    WebP: '#10b981',
    TIFF: '#ec4899',
    Unknown: '#64748b',
    Error: '#ef4444',
  };

  return (
    <div className="tool-section fade-in-up">
      <div className="tool-header">
        <h2>Metadata Extraction</h2>
        <p>Parse metadata from images - supports JPEG EXIF, PNG chunks, GIF, WebP, BMP, and TIFF. Strip metadata for privacy.</p>
      </div>

      <div className="glass-card">
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" className="drop-zone-preview" />
          ) : (
            <>
              <div className="drop-zone-icon"><Upload size={32} /></div>
              <p className="drop-zone-text">Drop image(s) here or click to upload</p>
              <p className="drop-zone-hint">JPEG, PNG, GIF, WebP, BMP, TIFF - multiple files supported</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.bmp,.tiff,.tif"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => processFiles(e.target.files)}
          />
        </div>

        {status && (
          <div className={`info-bar ${status.type}`}>
            {status.type === 'success' ? <CheckCircle size={14} /> : status.type === 'warning' ? <AlertTriangle size={14} /> : <XCircle size={14} />}
            {status.text}
          </div>
        )}

        {/* Batch tabs */}
        {results.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', marginTop: 'var(--space-md)', overflowX: 'auto', paddingBottom: '4px' }}>
            {results.map((r, i) => (
              <button
                key={i}
                className={`btn ${i === activeIndex ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleTabClick(i)}
                style={{ fontSize: '0.72rem', padding: '4px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: FORMAT_COLORS[r.format] || FORMAT_COLORS.Unknown,
                    marginRight: '6px',
                  }}
                />
                {r.fileName.length > 20 ? r.fileName.substring(0, 17) + '...' : r.fileName}
              </button>
            ))}
          </div>
        )}

        {/* Active result */}
        {activeResult && (
          <>
            {/* Format badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                background: `${FORMAT_COLORS[activeResult.format] || FORMAT_COLORS.Unknown}20`,
                color: FORMAT_COLORS[activeResult.format] || FORMAT_COLORS.Unknown,
                border: `1px solid ${FORMAT_COLORS[activeResult.format] || FORMAT_COLORS.Unknown}30`,
              }}>
                {activeResult.format}
              </span>
              {canStrip && (
                <button className="btn btn-secondary" onClick={handleStrip} disabled={isStripping} style={{ fontSize: '0.72rem', padding: '4px 12px' }}>
                  <Trash2 size={12} /> {isStripping ? 'Stripping...' : 'Strip metadata & download'}
                </button>
              )}
            </div>

            {/* Metadata table */}
            <div style={{ marginTop: 'var(--space-md)', overflowX: 'auto' }}>
              <table className="metadata-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {activeResult.fields.map((item, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{item.label}</td>
                      <td>{String(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* GPS Map */}
            {activeResult.gps && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} /> GPS Location
                </label>
                <div style={{
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  height: '300px',
                }}>
                  <iframe
                    title="GPS Location"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeResult.gps.longitude - 0.01}%2C${activeResult.gps.latitude - 0.01}%2C${activeResult.gps.longitude + 0.01}%2C${activeResult.gps.latitude + 0.01}&layer=mapnik&marker=${activeResult.gps.latitude}%2C${activeResult.gps.longitude}`}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-xs)', fontFamily: 'var(--font-mono)' }}>
                  {activeResult.gps.latitude.toFixed(6)}, {activeResult.gps.longitude.toFixed(6)}
                </p>
              </div>
            )}
          </>
        )}

        <div className="explainer-box">
          <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Supports JPEG (EXIF/IPTC), PNG (tEXt/iTXt/pHYs/tIME), GIF (header/comments), WebP (VP8X/EXIF), BMP (headers), and TIFF (IFD).
            Metadata stripping removes EXIF and IPTC data from JPEG/PNG while preserving the image. All processing is local.
          </span>
        </div>
      </div>
    </div>
  );
}
