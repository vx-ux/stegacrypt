import { useState } from 'react';
import { encodeText, decodeText, analyzeText } from '../utils/textStego';
import { Lock, Unlock, Search, Copy, CheckCircle, XCircle, AlertTriangle, Info, Loader } from './Icons';

export default function TextStego() {
  const [mode, setMode] = useState('encode');
  const [coverText, setCoverText] = useState('');
  const [secretMessage, setSecretMessage] = useState('');
  const [password, setPassword] = useState('');
  const [outputText, setOutputText] = useState('');
  const [decodeInput, setDecodeInput] = useState('');
  const [decodedMessage, setDecodedMessage] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [status, setStatus] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEncode = async () => {
    setIsProcessing(true);
    setStatus(null);
    try {
      const encoded = await encodeText(coverText, secretMessage, password);
      setOutputText(encoded);
      const stats = analyzeText(encoded);
      setAnalysis(stats);
      setStatus({ type: 'success', text: `Message hidden. ${stats.hiddenCharCount} invisible characters embedded.${password ? ' (AES-256-GCM encrypted)' : ''}` });
    } catch (err) {
      if (err.name === 'OperationError') {
        setStatus({ type: 'error', text: 'Encryption failed - invalid password.' });
      } else {
        setStatus({ type: 'error', text: err.message });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecode = async () => {
    setIsProcessing(true);
    setStatus(null);
    try {
      const decoded = await decodeText(decodeInput, password);
      setDecodedMessage(decoded);
      const stats = analyzeText(decodeInput);
      setAnalysis(stats);
      setStatus({ type: 'success', text: `Hidden message found - ${decoded.length} characters decoded.` });
    } catch (err) {
      if (err.name === 'OperationError') {
        setStatus({ type: 'error', text: 'Decryption failed - wrong password or corrupted data.' });
      } else {
        setStatus({ type: 'error', text: err.message });
      }
      setDecodedMessage('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyze = () => {
    const textToAnalyze = mode === 'encode' ? outputText : decodeInput;
    if (!textToAnalyze) {
      setStatus({ type: 'error', text: 'No text to analyze.' });
      return;
    }
    const stats = analyzeText(textToAnalyze);
    setAnalysis(stats);
    setStatus({
      type: stats.hasHiddenMessage ? 'warning' : 'success',
      text: stats.hasHiddenMessage
        ? `Detected ${stats.hiddenCharCount} hidden zero-width characters.`
        : 'No hidden characters detected.',
    });
  };

  return (
    <div className="tool-section fade-in-up">
      <div className="tool-header">
        <h2>Text Steganography</h2>
        <p>Conceal messages within ordinary text using invisible zero-width Unicode characters. The text appears completely normal.</p>
      </div>

      <div className="input-group">
        <div className="toggle-group">
          <button
            className={`toggle-option ${mode === 'encode' ? 'active' : ''}`}
            onClick={() => { setMode('encode'); setStatus(null); setAnalysis(null); }}
          >
            <Lock size={14} /> Encode
          </button>
          <button
            className={`toggle-option ${mode === 'decode' ? 'active' : ''}`}
            onClick={() => { setMode('decode'); setStatus(null); setAnalysis(null); }}
          >
            <Unlock size={14} /> Decode
          </button>
        </div>
      </div>

      <div className="glass-card">
        {mode === 'encode' ? (
          <>
            <div className="input-group">
              <label className="input-label">Cover text</label>
              <textarea
                className="input-field"
                placeholder='The visible text that carries the hidden message, e.g. "The meeting is at 3pm tomorrow."'
                value={coverText}
                onChange={(e) => setCoverText(e.target.value)}
                rows={3}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Secret message</label>
              <textarea
                className="input-field"
                placeholder="The message to hide inside the cover text..."
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                rows={2}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password (optional)</label>
              <input
                type="password"
                className="input-field"
                placeholder="Encryption password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleEncode} disabled={!coverText || !secretMessage || isProcessing}>
                {isProcessing ? <Loader size={15} /> : <Lock size={15} />} {isProcessing ? 'Encoding...' : 'Encode message'}
              </button>
            </div>

            {outputText && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <label className="input-label">Output - copy this text (it contains the hidden message)</label>
                <div className="encoded-output" style={{ userSelect: 'all' }}>
                  {outputText}
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 'var(--space-sm)' }}
                  onClick={() => navigator.clipboard.writeText(outputText)}
                >
                  <Copy size={14} /> Copy to clipboard
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="input-group">
              <label className="input-label">Paste suspicious text</label>
              <textarea
                className="input-field"
                placeholder="Paste text that might contain a hidden message..."
                value={decodeInput}
                onChange={(e) => setDecodeInput(e.target.value)}
                rows={4}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password (if encrypted)</label>
              <input
                type="password"
                className="input-field"
                placeholder="Encryption password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleDecode} disabled={!decodeInput || isProcessing}>
                {isProcessing ? <Loader size={15} /> : <Unlock size={15} />} {isProcessing ? 'Decoding...' : 'Decode'}
              </button>
              <button className="btn btn-secondary" onClick={handleAnalyze} disabled={!decodeInput}>
                <Search size={15} /> Analyze
              </button>
            </div>

            {decodedMessage && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <label className="input-label">Decoded message</label>
                <div className="decoded-output">
                  {decodedMessage}
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 'var(--space-sm)' }}
                  onClick={() => navigator.clipboard.writeText(decodedMessage)}
                >
                  <Copy size={14} /> Copy to clipboard
                </button>
              </div>
            )}
          </>
        )}

        {/* Status */}
        {status && (
          <div className={`info-bar ${status.type}`}>
            {status.type === 'success' ? <CheckCircle size={14} /> : status.type === 'warning' ? <AlertTriangle size={14} /> : <XCircle size={14} />}
            {status.text}
          </div>
        )}

        {/* Analysis */}
        {analysis && (
          <div className="char-counter">
            <div className="char-counter-item">
              <div className="char-counter-value">{analysis.visibleLength}</div>
              <div className="char-counter-label">Visible</div>
            </div>
            <div className="char-counter-item">
              <div className="char-counter-value">{analysis.actualLength}</div>
              <div className="char-counter-label">Actual</div>
            </div>
            <div className="char-counter-item">
              <div className="char-counter-value" style={{ color: analysis.hiddenCharCount > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                {analysis.hiddenCharCount}
              </div>
              <div className="char-counter-label">Hidden</div>
            </div>
            <div className="char-counter-item">
              <div className="char-counter-value" style={{ color: analysis.hasHiddenMessage ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                {analysis.hasHiddenMessage ? 'YES' : 'NO'}
              </div>
              <div className="char-counter-label">Suspicious</div>
            </div>
          </div>
        )}

        {/* Explainer */}
        <div className="explainer-box">
          <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Each character is converted to binary, then represented as invisible Unicode characters
            (Zero-Width Space = 0, Zero-Width Non-Joiner = 1) and embedded between the words of your cover text.
            When a password is provided, the message is encrypted with AES-256-GCM before embedding.
          </span>
        </div>
      </div>
    </div>
  );
}
