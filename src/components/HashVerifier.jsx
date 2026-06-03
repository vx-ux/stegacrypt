import { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle, XCircle, Copy, Info, Loader } from './Icons';

// ─── MD5 implementation (Web Crypto doesn't support MD5) ─────────────────────

function md5(buffer) {
  const bytes = new Uint8Array(buffer);
  const K = new Uint32Array([
    0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0fad,0x4787c62a,0xa8304613,0xfd469501,
    0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
    0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
    0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
    0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
    0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
    0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
    0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391
  ]);
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];

  const bitLen = bytes.length * 8;
  const padLen = ((bytes.length + 8) >>> 6 << 6) + 64;
  const padded = new Uint8Array(padLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const pdv = new DataView(padded.buffer);
  pdv.setUint32(padLen - 8, bitLen & 0xFFFFFFFF, true);
  pdv.setUint32(padLen - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let offset = 0; offset < padLen; offset += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) M[j] = pdv.getUint32(offset + j * 4, true);

    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }

      F = (F + A + K[i] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const result = new DataView(new ArrayBuffer(16));
  result.setUint32(0, a0, true);
  result.setUint32(4, b0, true);
  result.setUint32(8, c0, true);
  result.setUint32(12, d0, true);
  return Array.from(new Uint8Array(result.buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Hash computation ────────────────────────────────────────────────────────

async function computeHash(buffer, algorithm) {
  if (algorithm === 'MD5') return md5(buffer);
  const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computeAllHashes(buffer) {
  const start = performance.now();
  const [md5Hash, sha1, sha256, sha512] = await Promise.all([
    computeHash(buffer, 'MD5'),
    computeHash(buffer, 'SHA-1'),
    computeHash(buffer, 'SHA-256'),
    computeHash(buffer, 'SHA-512'),
  ]);
  const elapsed = (performance.now() - start).toFixed(0);
  return { md5: md5Hash, sha1, sha256, sha512, elapsed };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HashVerifier() {
  const [mode, setMode] = useState('single'); // 'single' | 'compare'
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [hashes1, setHashes1] = useState(null);
  const [hashes2, setHashes2] = useState(null);
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState(null);
  const [isDragging1, setIsDragging1] = useState(false);
  const [isDragging2, setIsDragging2] = useState(false);
  const fileRef1 = useRef(null);
  const fileRef2 = useRef(null);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  const processFile = useCallback(async (file, slot) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      setStatus({ type: 'error', text: 'File exceeds 100MB limit.' });
      return;
    }

    setIsProcessing(true);
    setStatus(null);
    setVerifyResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const hashes = await computeAllHashes(buffer);

      if (slot === 1) {
        setFile1({ name: file.name, size: file.size });
        setHashes1(hashes);
      } else {
        setFile2({ name: file.name, size: file.size });
        setHashes2(hashes);
      }

      setStatus({
        type: 'success',
        text: `Hashed ${file.name} in ${hashes.elapsed}ms`,
      });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleVerify = () => {
    if (!hashes1 || !verifyHash.trim()) return;
    const input = verifyHash.trim().toLowerCase();
    const match =
      hashes1.md5 === input ||
      hashes1.sha1 === input ||
      hashes1.sha256 === input ||
      hashes1.sha512 === input;

    const algo = input.length === 32 ? 'MD5' : input.length === 40 ? 'SHA-1' : input.length === 64 ? 'SHA-256' : input.length === 128 ? 'SHA-512' : 'Unknown';

    setVerifyResult({
      match,
      algo,
      text: match ? `\u2705 Hash matches (${algo})` : `\u274c Hash does NOT match any computed hash`,
    });
  };

  const compareResult = hashes1 && hashes2 ? hashes1.sha256 === hashes2.sha256 : null;

  const copyHash = (hash) => navigator.clipboard.writeText(hash);

  const HASH_ROWS = [
    { label: 'MD5', key: 'md5' },
    { label: 'SHA-1', key: 'sha1' },
    { label: 'SHA-256', key: 'sha256' },
    { label: 'SHA-512', key: 'sha512' },
  ];

  return (
    <div className="tool-section fade-in-up">
      <div className="tool-header">
        <h2>Hash Verifier</h2>
        <p>Compute MD5, SHA-1, SHA-256, and SHA-512 hashes for any file. Verify integrity or compare two files.</p>
      </div>

      <div className="input-group">
        <div className="toggle-group">
          <button
            className={`toggle-option ${mode === 'single' ? 'active' : ''}`}
            onClick={() => { setMode('single'); setFile2(null); setHashes2(null); setStatus(null); }}
          >
            Single file
          </button>
          <button
            className={`toggle-option ${mode === 'compare' ? 'active' : ''}`}
            onClick={() => { setMode('compare'); setStatus(null); }}
          >
            Compare two files
          </button>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'grid', gridTemplateColumns: mode === 'compare' ? '1fr 1fr' : '1fr', gap: 'var(--space-md)' }}>
          {/* File 1 */}
          <div
            className={`drop-zone ${isDragging1 ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging1(true); }}
            onDragLeave={() => setIsDragging1(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging1(false); processFile(e.dataTransfer.files[0], 1); }}
            onClick={() => fileRef1.current?.click()}
            style={{ minHeight: '120px' }}
          >
            {file1 ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fluid-sm)', color: 'var(--text-primary)' }}>{file1.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatSize(file1.size)}</p>
              </div>
            ) : (
              <>
                <div className="drop-zone-icon"><Upload size={24} /></div>
                <p className="drop-zone-text">{mode === 'compare' ? 'File A' : 'Drop any file here'}</p>
              </>
            )}
            <input ref={fileRef1} type="file" style={{ display: 'none' }} onChange={(e) => processFile(e.target.files[0], 1)} />
          </div>

          {/* File 2 (compare mode) */}
          {mode === 'compare' && (
            <div
              className={`drop-zone ${isDragging2 ? 'dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging2(true); }}
              onDragLeave={() => setIsDragging2(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging2(false); processFile(e.dataTransfer.files[0], 2); }}
              onClick={() => fileRef2.current?.click()}
              style={{ minHeight: '120px' }}
            >
              {file2 ? (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fluid-sm)', color: 'var(--text-primary)' }}>{file2.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatSize(file2.size)}</p>
                </div>
              ) : (
                <>
                  <div className="drop-zone-icon"><Upload size={24} /></div>
                  <p className="drop-zone-text">File B</p>
                </>
              )}
              <input ref={fileRef2} type="file" style={{ display: 'none' }} onChange={(e) => processFile(e.target.files[0], 2)} />
            </div>
          )}
        </div>

        {isProcessing && (
          <div className="info-bar" style={{ marginTop: 'var(--space-md)' }}>
            <Loader size={14} /> Computing hashes...
          </div>
        )}

        {status && (
          <div className={`info-bar ${status.type}`} style={{ marginTop: 'var(--space-md)' }}>
            {status.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {status.text}
          </div>
        )}

        {/* Compare result banner */}
        {mode === 'compare' && compareResult !== null && (
          <div className={`info-bar ${compareResult ? 'success' : 'error'}`} style={{ marginTop: 'var(--space-md)', fontSize: 'var(--fluid-body)' }}>
            {compareResult ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <strong>{compareResult ? 'Files are IDENTICAL' : 'Files are DIFFERENT'}</strong>
          </div>
        )}

        {/* Hash table */}
        {hashes1 && (
          <div style={{ marginTop: 'var(--space-lg)', overflowX: 'auto' }}>
            <table className="metadata-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>{mode === 'compare' && file1 ? file1.name : 'Hash'}</th>
                  {mode === 'compare' && hashes2 && <th>{file2?.name || 'File B'}</th>}
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {HASH_ROWS.map(({ label, key }) => (
                  <tr key={key}>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', wordBreak: 'break-all' }}>
                      {hashes1[key]}
                    </td>
                    {mode === 'compare' && hashes2 && (
                      <td style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        wordBreak: 'break-all',
                        color: hashes1[key] === hashes2[key] ? 'var(--accent-green)' : 'var(--accent-red, #ef4444)',
                      }}>
                        {hashes2[key]}
                      </td>
                    )}
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                        onClick={() => copyHash(hashes1[key])}
                        title="Copy hash"
                      >
                        <Copy size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Verify against known hash */}
        {mode === 'single' && hashes1 && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <div className="input-group">
              <label className="input-label">Verify against a known hash</label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Paste MD5, SHA-1, SHA-256, or SHA-512 hash..."
                  value={verifyHash}
                  onChange={(e) => { setVerifyHash(e.target.value); setVerifyResult(null); }}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleVerify} disabled={!verifyHash.trim()}>
                  Verify
                </button>
              </div>
            </div>
            {verifyResult && (
              <div className={`info-bar ${verifyResult.match ? 'success' : 'error'}`}>
                {verifyResult.match ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {verifyResult.text}
              </div>
            )}
          </div>
        )}

        <div className="explainer-box">
          <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Hashes are computed entirely in your browser using the Web Crypto API (SHA family) and a pure JS implementation (MD5).
            No data is uploaded. MD5 is included for legacy compatibility but is not cryptographically secure.
          </span>
        </div>
      </div>
    </div>
  );
}
