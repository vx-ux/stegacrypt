import { useState, useCallback, useRef } from 'react';
import { getAudioCapacity, getWaveformData } from '../utils/audioStego';
import { runWorkerTask } from '../workers/workerClient';
import { Lock, Unlock, Upload, Download, Copy, CheckCircle, XCircle, Info, Loader } from './Icons';

/**
 * Waveform bar-chart visualizer.
 * Renders a normalized amplitude array as vertical bars.
 */
function Waveform({ data, color = 'var(--accent-cyan)', label }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="waveform-wrapper">
      {label && <p className="waveform-label">{label}</p>}
      <div className="waveform-bars">
        {data.map((amp, i) => (
          <div
            key={i}
            className="waveform-bar"
            style={{
              height: `${Math.max(2, amp * 100)}%`,
              background: color,
              opacity: 0.7 + amp * 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AudioStego() {
  const [mode, setMode] = useState('encode');
  const [audioBuffer, setAudioBuffer] = useState(null);   // raw ArrayBuffer
  const [fileName, setFileName]       = useState('');
  const [waveform, setWaveform]       = useState(null);   // original waveform points
  const [encodedWaveform, setEncodedWaveform] = useState(null);
  const [message, setMessage]         = useState('');
  const [password, setPassword]       = useState('');
  const [capacity, setCapacity]       = useState(0);
  const [status, setStatus]           = useState(null);
  const [decodedText, setDecodedText] = useState('');
  const [encodedBuffer, setEncodedBuffer] = useState(null); // result ArrayBuffer for download
  const [isDragging, setIsDragging]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef(null);

  // ── File loading ────────────────────────────────────────────────────────────

  const loadFile = useCallback((file) => {
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) {
      setStatus({ type: 'error', text: 'File exceeds 50MB limit.' });
      return;
    }

    if (!file.name.toLowerCase().endsWith('.wav')) {
      setStatus({ type: 'error', text: 'Only WAV files are supported. Please upload a .wav file.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target.result;
        const cap = getAudioCapacity(buf);
        const wf  = getWaveformData(buf, 120);

        setAudioBuffer(buf);
        setFileName(file.name);
        setCapacity(cap);
        setWaveform(wf);
        setEncodedWaveform(null);
        setEncodedBuffer(null);
        setDecodedText('');
        setStatus({ type: 'success', text: `Loaded "${file.name}" — ${cap.toLocaleString()} characters available.` });
      } catch (err) {
        setStatus({ type: 'error', text: err.message });
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    loadFile(e.dataTransfer.files[0]);
  }, [loadFile]);

  // ── Encode ──────────────────────────────────────────────────────────────────

  const handleEncode = async () => {
    if (!audioBuffer || !message) {
      setStatus({ type: 'error', text: 'Please upload a WAV file and enter a message.' });
      return;
    }

    setIsProcessing(true);
    setStatus(null);

    try {
      const result = await runWorkerTask(
        'audio:encode', 
        { buffer: audioBuffer, message, password },
        // Transfer a copy to not destroy the original buffer for the user
        [audioBuffer.slice(0)]
      );
      const resultWf = getWaveformData(result, 120);
      setEncodedBuffer(result);
      setEncodedWaveform(resultWf);
      setStatus({ type: 'success', text: `Encoded ${message.length} characters into "${fileName}".` });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Decode ──────────────────────────────────────────────────────────────────

  const handleDecode = async () => {
    if (!audioBuffer) {
      setStatus({ type: 'error', text: 'Please upload a WAV file to decode.' });
      return;
    }

    setIsProcessing(true);
    setStatus(null);

    try {
      const text = await runWorkerTask('audio:decode', { buffer: audioBuffer, password });
      setDecodedText(text);
      setStatus({ type: 'success', text: `Decoded ${text.length} characters from "${fileName}".` });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
      setDecodedText('');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────────

  const handleDownload = () => {
    if (!encodedBuffer) return;
    const blob = new Blob([encodedBuffer], { type: 'audio/wav' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `stegacrypt_${fileName || 'encoded.wav'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const usedPercent = message.length > 0 && capacity > 0
    ? Math.min((message.length / capacity) * 100, 100)
    : 0;

  const resetMode = (newMode) => {
    setMode(newMode);
    setStatus(null);
    setDecodedText('');
    setEncodedBuffer(null);
    setEncodedWaveform(null);
  };

  return (
    <div className="tool-section fade-in-up">
      <div className="tool-header">
        <h2>Audio Steganography</h2>
        <p>
          Conceal messages inside WAV audio files by modifying the Least Significant Bit of each
          sample. The change is ±1 amplitude unit — completely inaudible to the human ear.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="input-group">
        <div className="toggle-group">
          <button
            className={`toggle-option ${mode === 'encode' ? 'active' : ''}`}
            onClick={() => resetMode('encode')}
          >
            <Lock size={14} /> Encode
          </button>
          <button
            className={`toggle-option ${mode === 'decode' ? 'active' : ''}`}
            onClick={() => resetMode('decode')}
          >
            <Unlock size={14} /> Decode
          </button>
        </div>
      </div>

      <div className="glass-card">
        {/* Drop zone */}
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {audioBuffer ? (
            <div className="audio-loaded">
              <div className="audio-loaded-icon">
                {/* Speaker wave icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </div>
              <p className="audio-loaded-name">{fileName}</p>
              <p className="drop-zone-hint">Click or drop to replace</p>
            </div>
          ) : (
            <>
              <div className="drop-zone-icon"><Upload size={32} /></div>
              <p className="drop-zone-text">Drop a WAV file here or click to upload</p>
              <p className="drop-zone-hint">Only uncompressed PCM WAV files are supported</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,audio/wav"
            style={{ display: 'none' }}
            onChange={(e) => loadFile(e.target.files[0])}
          />
        </div>

        {/* Waveform preview */}
        {waveform && (
          <div className="waveform-section">
            {mode === 'encode' && encodedWaveform ? (
              <div className="comparison-grid" style={{ marginTop: 'var(--space-lg)' }}>
                <div className="comparison-panel">
                  <h4>Original</h4>
                  <Waveform data={waveform} color="var(--accent-cyan)" />
                </div>
                <div className="comparison-panel">
                  <h4>Encoded</h4>
                  <Waveform data={encodedWaveform} color="var(--accent-green)" />
                </div>
              </div>
            ) : (
              <Waveform data={waveform} color="var(--accent-cyan)" label="Waveform" />
            )}
          </div>
        )}

        {/* Controls */}
        {audioBuffer && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
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
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label">Capacity</label>
                <div style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  color: 'var(--accent-cyan)',
                }}>
                  {capacity.toLocaleString()} chars
                </div>
              </div>
            </div>

            {mode === 'encode' && (
              <>
                <div className="input-group" style={{ marginTop: 'var(--space-lg)' }}>
                  <label className="input-label">Secret message</label>
                  <textarea
                    className="input-field"
                    placeholder="Enter the message to hide in the audio..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Capacity bar */}
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

                <div className="btn-group" style={{ marginTop: 'var(--space-lg)' }}>
                  <button className="btn btn-primary" onClick={handleEncode} disabled={!message || isProcessing}>
                    {isProcessing ? <Loader size={15} /> : <Lock size={15} />} 
                    {isProcessing ? 'Encoding...' : 'Encode message'}
                  </button>
                  {encodedBuffer && (
                    <button className="btn btn-secondary" onClick={handleDownload}>
                      <Download size={15} /> Download WAV
                    </button>
                  )}
                </div>
              </>
            )}

            {mode === 'decode' && (
              <div className="btn-group" style={{ marginTop: 'var(--space-lg)' }}>
                <button className="btn btn-primary" onClick={handleDecode} disabled={isProcessing}>
                  {isProcessing ? <Loader size={15} /> : <Unlock size={15} />} 
                  {isProcessing ? 'Decoding...' : 'Decode message'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Status bar */}
        {status && (
          <div className={`info-bar ${status.type}`} style={{ marginTop: 'var(--space-md)' }}>
            {status.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {status.text}
          </div>
        )}

        {/* Decoded output */}
        {mode === 'decode' && decodedText && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <label className="input-label">Decoded message</label>
            <div className="decoded-output">{decodedText}</div>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 'var(--space-sm)' }}
              onClick={() => navigator.clipboard.writeText(decodedText)}
            >
              <Copy size={14} /> Copy to clipboard
            </button>
          </div>
        )}

        {/* Info box */}
        <div className="explainer-box" style={{ marginTop: 'var(--space-lg)' }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Each 16-bit audio sample is modified by at most 1 unit (out of 65,536 possible values).
            At 44.1 kHz stereo, a 3-minute WAV can store approximately 15 MB of hidden text.
            The encoded file is indistinguishable from the original by ear.
          </span>
        </div>
      </div>
    </div>
  );
}
