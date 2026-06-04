import { useState, useRef, useCallback, useMemo } from 'react';
import { Upload, Search, Info, XCircle } from './Icons';


const FILE_SIGNATURES = [
  { name: 'JPEG Image', ext: 'jpg', bytes: [0xFF, 0xD8, 0xFF] },
  { name: 'PNG Image', ext: 'png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { name: 'GIF Image', ext: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { name: 'BMP Image', ext: 'bmp', bytes: [0x42, 0x4D] },
  { name: 'WebP Image', ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46], extraCheck: (b) => b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  { name: 'PDF Document', ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { name: 'ZIP Archive', ext: 'zip', bytes: [0x50, 0x4B, 0x03, 0x04] },
  { name: 'GZIP Archive', ext: 'gz', bytes: [0x1F, 0x8B] },
  { name: 'RAR Archive', ext: 'rar', bytes: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07] },
  { name: '7-Zip Archive', ext: '7z', bytes: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] },
  { name: 'WAV Audio', ext: 'wav', bytes: [0x52, 0x49, 0x46, 0x46], extraCheck: (b) => b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45 },
  { name: 'MP3 Audio', ext: 'mp3', bytes: [0x49, 0x44, 0x33] },
  { name: 'OGG Audio', ext: 'ogg', bytes: [0x4F, 0x67, 0x67, 0x53] },
  { name: 'FLAC Audio', ext: 'flac', bytes: [0x66, 0x4C, 0x61, 0x43] },
  { name: 'MP4 Video', ext: 'mp4', bytes: [0x00, 0x00, 0x00], extraCheck: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
  { name: 'ELF Executable', ext: 'elf', bytes: [0x7F, 0x45, 0x4C, 0x46] },
  { name: 'PE Executable', ext: 'exe', bytes: [0x4D, 0x5A] },
  { name: 'Mach-O Binary', ext: 'macho', bytes: [0xCF, 0xFA, 0xED, 0xFE] },
  { name: 'SQLite Database', ext: 'sqlite', bytes: [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65] },
  { name: 'WASM Binary', ext: 'wasm', bytes: [0x00, 0x61, 0x73, 0x6D] },
  { name: 'TIFF Image (LE)', ext: 'tiff', bytes: [0x49, 0x49, 0x2A, 0x00] },
  { name: 'TIFF Image (BE)', ext: 'tiff', bytes: [0x4D, 0x4D, 0x00, 0x2A] },
];

function detectSignature(bytes) {
  for (const sig of FILE_SIGNATURES) {
    if (sig.bytes.every((b, i) => bytes[i] === b)) {
      if (sig.extraCheck && !sig.extraCheck(bytes)) continue;
      return sig;
    }
  }
  return null;
}


const ROW_HEIGHT = 24;
const VISIBLE_ROWS = 32;

export default function HexViewer() {
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [signature, setSignature] = useState(null);
  const [bytesPerRow, setBytesPerRow] = useState(16);
  const [scrollTop, setScrollTop] = useState(0);
  const [jumpOffset, setJumpOffset] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('hex'); // 'hex' | 'ascii'
  const [searchResults, setSearchResults] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  };

  const loadFile = useCallback((file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('File exceeds 20MB limit for hex viewer.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target.result;
      const bytes = new Uint8Array(buffer);
      setFileData(bytes);
      setFileName(file.name);
      setFileSize(file.size);
      setSignature(detectSignature(bytes));
      setScrollTop(0);
      setSearchResults([]);
      setCurrentMatch(-1);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const totalRows = fileData ? Math.ceil(fileData.length / bytesPerRow) : 0;

  const startRow = Math.floor(scrollTop / ROW_HEIGHT);
  const endRow = Math.min(startRow + VISIBLE_ROWS + 2, totalRows);

  // Build a Set of matched offsets for highlighting
  const matchSet = useMemo(() => {
    const s = new Set();
    for (const offset of searchResults) {
      // Highlight the matched bytes
      const len = searchType === 'hex'
        ? searchQuery.replace(/\s+/g, '').length / 2
        : searchQuery.length;
      for (let i = 0; i < len; i++) s.add(offset + i);
    }
    return s;
  }, [searchResults, searchQuery, searchType]);

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  const handleJump = () => {
    const offset = parseInt(jumpOffset, 16);
    if (isNaN(offset) || !scrollRef.current) return;
    const row = Math.floor(offset / bytesPerRow);
    scrollRef.current.scrollTop = row * ROW_HEIGHT;
  };

  const handleSearch = () => {
    if (!fileData || !searchQuery.trim()) return;
    const results = [];

    if (searchType === 'hex') {
      const hexStr = searchQuery.replace(/\s+/g, '').toLowerCase();
      if (hexStr.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hexStr)) return;
      const pattern = [];
      for (let i = 0; i < hexStr.length; i += 2) {
        pattern.push(parseInt(hexStr.substring(i, i + 2), 16));
      }

      for (let i = 0; i <= fileData.length - pattern.length; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
          if (fileData[i + j] !== pattern[j]) { match = false; break; }
        }
        if (match) {
          results.push(i);
          if (results.length >= 500) break;
        }
      }
    } else {
      // ASCII search
      const query = searchQuery;
      for (let i = 0; i <= fileData.length - query.length; i++) {
        let match = true;
        for (let j = 0; j < query.length; j++) {
          if (fileData[i + j] !== query.charCodeAt(j)) { match = false; break; }
        }
        if (match) {
          results.push(i);
          if (results.length >= 500) break;
        }
      }
    }

    setSearchResults(results);
    setCurrentMatch(results.length > 0 ? 0 : -1);

    // Jump to first match
    if (results.length > 0 && scrollRef.current) {
      const row = Math.floor(results[0] / bytesPerRow);
      scrollRef.current.scrollTop = row * ROW_HEIGHT;
    }
  };

  const jumpToMatch = (dir) => {
    if (searchResults.length === 0) return;
    const next = (currentMatch + dir + searchResults.length) % searchResults.length;
    setCurrentMatch(next);
    if (scrollRef.current) {
      const row = Math.floor(searchResults[next] / bytesPerRow);
      scrollRef.current.scrollTop = row * ROW_HEIGHT;
    }
  };

  const renderRows = () => {
    if (!fileData) return null;
    const rows = [];

    for (let row = startRow; row < endRow; row++) {
      const offset = row * bytesPerRow;
      if (offset >= fileData.length) break;

      const hexCells = [];
      const asciiChars = [];

      for (let col = 0; col < bytesPerRow; col++) {
        const byteOffset = offset + col;
        if (byteOffset < fileData.length) {
          const byte = fileData[byteOffset];
          const isHighlighted = matchSet.has(byteOffset);
          const isCurrentHighlight = searchResults[currentMatch] !== undefined &&
            byteOffset >= searchResults[currentMatch] &&
            byteOffset < searchResults[currentMatch] + (searchType === 'hex' ? searchQuery.replace(/\s+/g, '').length / 2 : searchQuery.length);

          hexCells.push(
            <span
              key={col}
              className={`hex-byte ${col % 2 === 0 ? 'hex-even' : 'hex-odd'} ${isCurrentHighlight ? 'hex-current-match' : isHighlighted ? 'hex-match' : ''}`}
            >
              {byte.toString(16).padStart(2, '0')}
            </span>
          );

          const ch = byte >= 0x20 && byte <= 0x7E ? String.fromCharCode(byte) : '.';
          asciiChars.push(
            <span
              key={col}
              className={isCurrentHighlight ? 'hex-current-match' : isHighlighted ? 'hex-match' : ''}
            >
              {ch}
            </span>
          );
        } else {
          hexCells.push(<span key={col} className="hex-byte hex-empty">{'  '}</span>);
          asciiChars.push(<span key={col}> </span>);
        }
      }

      rows.push(
        <div
          key={row}
          className="hex-row"
          style={{ position: 'absolute', top: `${row * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
        >
          <span className="hex-offset">{offset.toString(16).padStart(8, '0')}</span>
          <span className="hex-bytes">{hexCells}</span>
          <span className="hex-ascii">{asciiChars}</span>
        </div>
      );
    }

    return rows;
  };

  return (
    <div className="tool-section fade-in-up">
      <div className="tool-header">
        <h2>Hex Viewer</h2>
        <p>Inspect the raw binary contents of any file. Navigate, search, and identify file signatures.</p>
      </div>

      <div className="glass-card">
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); loadFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
          style={{ minHeight: '100px' }}
        >
          {fileName ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fluid-sm)', color: 'var(--text-primary)' }}>{fileName}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatSize(fileSize)} · {totalRows.toLocaleString()} rows</p>
            </div>
          ) : (
            <>
              <div className="drop-zone-icon"><Upload size={24} /></div>
              <p className="drop-zone-text">Drop any file to inspect its hex dump</p>
              <p className="drop-zone-hint">PNG, JPG, PDF, ZIP, EXE, WAV - any file format</p>
            </>
          )}
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => loadFile(e.target.files[0])} />
        </div>

        {/* File info bar */}
        {signature && (
          <div className="info-bar success" style={{ marginTop: 'var(--space-md)' }}>
            <Info size={14} />
            Detected: <strong>{signature.name}</strong> ({signature.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')})
          </div>
        )}

        {/* Controls */}
        {fileData && (
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ margin: 0, flex: '0 0 auto' }}>
              <label className="input-label">Bytes/row</label>
              <select className="select-field" value={bytesPerRow} onChange={(e) => setBytesPerRow(Number(e.target.value))}>
                <option value={8}>8</option>
                <option value={16}>16</option>
                <option value={32}>32</option>
              </select>
            </div>
            <div className="input-group" style={{ margin: 0, flex: '0 0 auto' }}>
              <label className="input-label">Jump to offset</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. 1A2F"
                  value={jumpOffset}
                  onChange={(e) => setJumpOffset(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', width: '100px' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                />
                <button className="btn btn-secondary" onClick={handleJump} style={{ padding: '6px 10px' }}>Go</button>
              </div>
            </div>
            <div className="input-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
              <label className="input-label">Search</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select className="select-field" value={searchType} onChange={(e) => setSearchType(e.target.value)} style={{ width: '70px' }}>
                  <option value="hex">Hex</option>
                  <option value="ascii">ASCII</option>
                </select>
                <input
                  type="text"
                  className="input-field"
                  placeholder={searchType === 'hex' ? 'FF D8 FF' : 'RIFF'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', flex: 1 }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button className="btn btn-primary" onClick={handleSearch} style={{ padding: '6px 10px' }}>
                  <Search size={14} />
                </button>
              </div>
            </div>
            {searchResults.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <button className="btn btn-secondary" onClick={() => jumpToMatch(-1)} style={{ padding: '4px 8px' }}>&lt;</button>
                <span>{currentMatch + 1}/{searchResults.length}</span>
                <button className="btn btn-secondary" onClick={() => jumpToMatch(1)} style={{ padding: '4px 8px' }}>&gt;</button>
              </div>
            )}
          </div>
        )}

        {/* Hex dump grid */}
        {fileData && (
          <div className="hex-viewer-container" style={{ marginTop: 'var(--space-md)' }}>
            <div className="hex-header">
              <span className="hex-offset">Offset</span>
              <span className="hex-bytes">
                {Array.from({ length: bytesPerRow }, (_, i) => (
                  <span key={i} className={`hex-byte hex-col-label ${i % 2 === 0 ? 'hex-even' : 'hex-odd'}`}>
                    {i.toString(16).padStart(2, '0').toUpperCase()}
                  </span>
                ))}
              </span>
              <span className="hex-ascii-label">ASCII</span>
            </div>
            <div
              ref={scrollRef}
              className="hex-scroll-area"
              onScroll={handleScroll}
              style={{ height: `${VISIBLE_ROWS * ROW_HEIGHT}px` }}
            >
              <div style={{ height: `${totalRows * ROW_HEIGHT}px`, position: 'relative' }}>
                {renderRows()}
              </div>
            </div>
          </div>
        )}

        {!fileData && (
          <div className="explainer-box">
            <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              The hex viewer renders a classic offset | hex | ASCII layout. It uses virtualized scrolling for performance.
              Supports file signature detection for 20+ formats including JPEG, PNG, PDF, ZIP, EXE, WAV, and more.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
