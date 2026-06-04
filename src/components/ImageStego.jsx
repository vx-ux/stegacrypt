import { useState, useCallback, useRef, useEffect } from 'react';
import { getCapacity } from '../utils/lsb';
import { runWorkerTask } from '../workers/workerClient';
import { Lock, Unlock, Upload, Download, Copy, CheckCircle, XCircle, Loader } from './Icons';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [decodeMode, setDecodeMode] = useState('stegacrypt'); // 'stegacrypt' | 'raw'

  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (mode === 'encode' && typeof result === 'string' && result.startsWith('blob:')) {
        URL.revokeObjectURL(result);
      }
    };
  }, [imagePreview, result, mode]);

  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      setStatus({ type: 'error', text: 'Please upload a valid image file (PNG recommended).' });
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setStatus({ type: 'error', text: 'File exceeds 20MB limit.' });
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    const url = URL.createObjectURL(file);
    setImagePreview(url);

    const img = new Image();
    img.onload = () => {
      setImage(img);
      setResult(null);
      setStatus(null);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height);
      setImageData(data);
      setCapacity(getCapacity(data, bitsPerChannel, !!password));
    };
    img.src = url;
  }, [bitsPerChannel, imagePreview, password]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    loadImage(e.dataTransfer.files[0]);
  }, [loadImage]);

  const handleEncode = async () => {
    if (!imageData || !message) {
      setStatus({ type: 'error', text: 'Please load an image and enter a message.' });
      return;
    }

    setIsProcessing(true);
    setStatus(null);

    try {
      const clonedData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );

      const encodedData = await runWorkerTask(
        'lsb:encode',
        { imageData: clonedData, message, password, bitsPerChannel },
        [clonedData.data.buffer]
      );

      const offCanvas = document.createElement('canvas');
      offCanvas.width = encodedData.width;
      offCanvas.height = encodedData.height;
      offCanvas.getContext('2d').putImageData(encodedData, 0, 0);

      const blob = await new Promise(resolve => offCanvas.toBlob(resolve, 'image/png'));
      const url = URL.createObjectURL(blob);

      if (typeof result === 'string' && result.startsWith('blob:')) {
        URL.revokeObjectURL(result);
      }
      
      setResult(url);
      setStatus({
        type: 'success',
        text: `Encoded ${message.length} characters using ${bitsPerChannel}-bit LSB.`,
      });
    } catch (err) {
      if (err.name === 'OperationError') {
        setStatus({ type: 'error', text: 'Encryption failed — invalid password.' });
      } else {
        setStatus({ type: 'error', text: err.message });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecode = async () => {
    if (!imageData) {
      setStatus({ type: 'error', text: 'Please load an image to decode.' });
      return;
    }

    setIsProcessing(true);
    setStatus(null);

    try {
      const clonedData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );

      let decoded;
      if (decodeMode === 'raw') {
        decoded = await runWorkerTask('lsb:decodeRaw', {
          imageData: clonedData,
          bitsPerChannel
        });
      } else {
        decoded = await runWorkerTask('lsb:decode', {
          imageData: clonedData,
          password,
          bitsPerChannel
        });
      }

      setResult(decoded);
      setStatus({
        type: 'success',
        text: `Decoded ${decoded.length} characters from image (${decodeMode === 'raw' ? 'Raw LSB' : 'StegaCrypt'} format).`,
      });
    } catch (err) {
      if (err.name === 'OperationError') {
        setStatus({ type: 'error', text: 'Decryption failed — wrong password or corrupted data.' });
      } else {
        setStatus({ type: 'error', text: err.message });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result || typeof result !== 'string') return;
    const link = document.createElement('a');
    link.download = 'stegacrypt_encoded.png';
    link.href = result;
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
          {imagePreview ? (
            <img src={imagePreview} className="drop-zone-preview" alt="Preview" />
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Bits per channel</label>
            <select
              className="select-field"
              value={bitsPerChannel}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBitsPerChannel(val);
                if (imageData) setCapacity(getCapacity(imageData, val, !!password));
              }}
            >
              <option value={1}>1 bit — least detectable</option>
              <option value={2}>2 bits — balanced</option>
              <option value={4}>4 bits — maximum capacity</option>
            </select>
          </div>
          {!(mode === 'decode' && decodeMode === 'raw') && (
            <div className="input-group" style={{ margin: 0 }}>
              <label className="input-label">Password (optional)</label>
              <input
                type="password"
                className="input-field"
                placeholder="Encryption password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (imageData) setCapacity(getCapacity(imageData, bitsPerChannel, !!e.target.value));
                }}
              />
            </div>
          )}
        </div>

        {mode === 'decode' && (
          <div className="input-group" style={{ marginTop: 'var(--space-md)' }}>
            <label className="input-label">Decode format</label>
            <div className="toggle-group">
              <button
                className={`toggle-option ${decodeMode === 'stegacrypt' ? 'active' : ''}`}
                onClick={() => setDecodeMode('stegacrypt')}
              >
                StegaCrypt Format (Auto-detect)
              </button>
              <button
                className={`toggle-option ${decodeMode === 'raw' ? 'active' : ''}`}
                onClick={() => setDecodeMode('raw')}
              >
                Raw LSB (null-terminated)
              </button>
            </div>
          </div>
        )}

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
              <button className="btn btn-primary" onClick={handleEncode} disabled={!image || !message || isProcessing}>
                {isProcessing ? <Loader size={15} /> : <Lock size={15} />} 
                {isProcessing ? 'Encoding...' : 'Encode message'}
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
              <button className="btn btn-primary" onClick={handleDecode} disabled={!image || isProcessing}>
                {isProcessing ? <Loader size={15} /> : <Unlock size={15} />} 
                {isProcessing ? 'Decoding...' : 'Decode message'}
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
              <img 
                src={imagePreview} 
                style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: 'var(--radius-sm)' }} 
                alt="Original" 
              />
            </div>
            <div className="comparison-panel">
              <h4>Encoded</h4>
              <img 
                src={result} 
                style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: 'var(--radius-sm)' }} 
                alt="Encoded" 
              />
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
