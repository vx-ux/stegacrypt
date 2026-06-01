import { useState, useCallback, useRef } from 'react';
import { encode, decode, getCapacity } from '../utils/lsb';
import { Lock, Unlock, Upload, Download, Copy, CheckCircle, XCircle } from './Icons';

export default function ImageStego() {
  const [mode, setMode] = useState('encode');
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [bitsPerChannel, setBitsPerChannel] = useState(1);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [capacity, setCapacity] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const canvasOriginalRef = useRef(null);
  const canvasResultRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      setStatus({ type: 'error', text: 'Please upload a valid image file (PNG recommended).' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setResult(null);
        setStatus(null);

        const canvas = canvasOriginalRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        setImageData(data);
        setCapacity(getCapacity(data, bitsPerChannel));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, [bitsPerChannel]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    loadImage(e.dataTransfer.files[0]);
  }, [loadImage]);

  const handleEncode = () => {
    if (!imageData || !message) {
      setStatus({ type: 'error', text: 'Please load an image and enter a message.' });
      return;
    }

    try {
      const clonedData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );

      const encoded = encode(clonedData, message, bitsPerChannel, password);

      const canvas = canvasResultRef.current;
      canvas.width = encoded.width;
      canvas.height = encoded.height;
      canvas.getContext('2d').putImageData(encoded, 0, 0);

      setResult(canvas);
      setStatus({
        type: 'success',
        text: `Encoded ${message.length} characters using ${bitsPerChannel}-bit LSB.`,
      });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    }
  };

  const handleDecode = () => {
    if (!imageData) {
      setStatus({ type: 'error', text: 'Please load an image to decode.' });
      return;
    }

    try {
      const decoded = decode(imageData, bitsPerChannel, password);
      setResult(decoded);
      setStatus({
        type: 'success',
        text: `Decoded ${decoded.length} characters from image.`,
      });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    }
  };

  const handleDownload = () => {
    const canvas = canvasResultRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'stegacrypt_encoded.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const usedPercent = message.length > 0 && capacity > 0
    ? Math.min((message.length / capacity) * 100, 100)
    : 0;

  return (
    <div className="tool-section fade-in-up">
      <div className="tool-header">
        <h2>Image Steganography</h2>
        <p>Hide messages inside image pixels using Least Significant Bit (LSB) encoding. Changes are imperceptible to the human eye.</p>
      </div>

      <div className="input-group">
        <div className="toggle-group">
          <button
            className={`toggle-option ${mode === 'encode' ? 'active' : ''}`}
            onClick={() => { setMode('encode'); setResult(null); setStatus(null); }}
          >
            <Lock size={14} /> Encode
          </button>
          <button
            className={`toggle-option ${mode === 'decode' ? 'active' : ''}`}
            onClick={() => { setMode('decode'); setResult(null); setStatus(null); }}
          >
            <Unlock size={14} /> Decode
          </button>
        </div>
      </div>

      <div className="glass-card">
        {/* Drop Zone */}
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {image ? (
            <canvas ref={canvasOriginalRef} className="drop-zone-preview" />
          ) : (
            <>
              <div className="drop-zone-icon"><Upload size={32} /></div>
              <p className="drop-zone-text">Drop an image here or click to upload</p>
              <p className="drop-zone-hint">PNG, JPG, BMP supported — PNG recommended for lossless output</p>
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

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Bits per channel</label>
            <select
              className="select-field"
              value={bitsPerChannel}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBitsPerChannel(val);
                if (imageData) setCapacity(getCapacity(imageData, val));
              }}
            >
              <option value={1}>1 bit — least detectable</option>
              <option value={2}>2 bits — balanced</option>
              <option value={4}>4 bits — maximum capacity</option>
            </select>
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Password (optional)</label>
            <input
              type="password"
              className="input-field"
              placeholder="XOR encryption key"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        {mode === 'encode' && (
          <>
            <div className="input-group">
              <label className="input-label">Secret message</label>
              <textarea
                className="input-field"
                placeholder="Enter the message you want to hide..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
              />
            </div>

            {image && (
              <div className="capacity-bar-wrapper">
                <div className="capacity-bar-label">
                  <span>{message.length} / {capacity.toLocaleString()} characters</span>
                  <span>{usedPercent.toFixed(1)}%</span>
                </div>
                <div className="capacity-bar">
                  <div
                    className={`capacity-bar-fill ${usedPercent > 90 ? 'warning' : ''}`}
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="btn-group" style={{ marginTop: 'var(--space-lg)' }}>
              <button className="btn btn-primary" onClick={handleEncode} disabled={!image || !message}>
                <Lock size={15} /> Encode message
              </button>
              {result && (
                <button className="btn btn-secondary" onClick={handleDownload}>
                  <Download size={15} /> Download PNG
                </button>
              )}
            </div>
          </>
        )}

        {mode === 'decode' && (
          <div className="btn-group" style={{ marginTop: 'var(--space-lg)' }}>
            <button className="btn btn-primary" onClick={handleDecode} disabled={!image}>
              <Unlock size={15} /> Decode message
            </button>
          </div>
        )}

        {/* Status */}
        {status && (
          <div className={`info-bar ${status.type}`}>
            {status.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {status.text}
          </div>
        )}

        {/* Encode result — comparison */}
        {mode === 'encode' && result && (
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
                style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: 'var(--radius-sm)' }}
              />
            </div>
            <div className="comparison-panel">
              <h4>Encoded</h4>
              <canvas ref={canvasResultRef} style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: 'var(--radius-sm)' }} />
            </div>
          </div>
        )}

        {/* Decode result */}
        {mode === 'decode' && typeof result === 'string' && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <label className="input-label">Decoded message</label>
            <div className="decoded-output">
              {result}
            </div>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 'var(--space-sm)' }}
              onClick={() => navigator.clipboard.writeText(result)}
            >
              <Copy size={14} /> Copy to clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
