import { useState, useRef, useCallback } from 'react';
import { extractExif, formatMetadata } from '../utils/exif';
import { Upload, CheckCircle, XCircle, AlertTriangle, MapPin, Info } from './Icons';

export default function MetadataViewer() {
  const [metadata, setMetadata] = useState(null);
  const [formattedData, setFormattedData] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [status, setStatus] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const loadFile = useCallback((file) => {
    if (!file) return;

    setFileName(file.name);
    setFileSize(file.size);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);

      const img = new Image();
      img.onload = () => setImageDimensions({ width: img.width, height: img.height });
      img.src = url;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const exif = extractExif(e.target.result);
        setMetadata(exif);
        const formatted = formatMetadata(exif);

        const allData = [
          { label: 'File Name', value: file.name },
          { label: 'File Size', value: formatFileSize(file.size) },
          { label: 'MIME Type', value: file.type },
          ...formatted,
        ];

        setFormattedData(allData);

        if (formatted.length > 0) {
          setStatus({ type: 'success', text: `Extracted ${formatted.length} metadata fields.` });
        } else {
          setStatus({ type: 'warning', text: 'No EXIF metadata found. The image may have been stripped.' });
        }
      } catch (err) {
        setStatus({ type: 'error', text: `Error parsing metadata: ${err.message}` });
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    loadFile(e.dataTransfer.files[0]);
  }, [loadFile]);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  return (
    <div className="tool-section fade-in-up">
      <div className="tool-header">
        <h2>Metadata Extraction</h2>
        <p>Parse EXIF metadata from images — camera info, GPS coordinates, timestamps, software, and more.</p>
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
              <p className="drop-zone-text">Drop an image here or click to upload</p>
              <p className="drop-zone-hint">Best results with unedited JPEG photos from cameras or phones</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => loadFile(e.target.files[0])}
          />
        </div>

        {status && (
          <div className={`info-bar ${status.type}`}>
            {status.type === 'success' ? <CheckCircle size={14} /> : status.type === 'warning' ? <AlertTriangle size={14} /> : <XCircle size={14} />}
            {status.text}
          </div>
        )}

        {formattedData.length > 0 && (
          <div style={{ marginTop: 'var(--space-lg)', overflowX: 'auto' }}>
            <table className="metadata-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {formattedData.map((item, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{item.label}</td>
                    <td>{item.value}</td>
                  </tr>
                ))}
                {imageDimensions && !formattedData.some(d => d.label === 'Dimensions') && (
                  <tr>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Dimensions</td>
                    <td>{imageDimensions.width} &times; {imageDimensions.height}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {metadata?.gps && (
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
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${metadata.gps.longitude - 0.01}%2C${metadata.gps.latitude - 0.01}%2C${metadata.gps.longitude + 0.01}%2C${metadata.gps.latitude + 0.01}&layer=mapnik&marker=${metadata.gps.latitude}%2C${metadata.gps.longitude}`}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-xs)', fontFamily: 'var(--font-mono)' }}>
              {metadata.gps.latitude.toFixed(6)}, {metadata.gps.longitude.toFixed(6)}
            </p>
          </div>
        )}

        <div className="explainer-box">
          <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            EXIF data is embedded by cameras and phones when capturing photos. It can contain sensitive information
            like GPS location and device details. Social media platforms typically strip this data, but directly shared files may retain it.
          </span>
        </div>
      </div>
    </div>
  );
}
