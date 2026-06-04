const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const targetExts = ['.js', '.jsx', '.css'];
const srcDir = path.join(__dirname, 'src');

walkDir(srcDir, (filePath) => {
  if (!targetExts.includes(path.extname(filePath))) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace unicode escape sequence for em dash
  content = content.replace(/\\u2014/g, '-');

  // Replace HTML entity em dashes
  content = content.replace(/&mdash;/g, '-');
  
  // Replace un-encoded en-dashes
  content = content.replace(/–/g, '-');

  // Remove JSX decorative comments like {/* ════════════ HERO ════════════ */} or {/* ── HERO ── */}
  content = content.replace(/\{\/\*\s*[═─]+\s*.*?\s*[═─]+\s*\*\/\}/g, '');

  // Remove multi-line decorative comments like /* ── Section Data ── */
  content = content.replace(/\/\*\s*[═─]+[\s\S]*?[═─]+\s*\*\//g, '');

  // Remove single line decorative comments with ════ or ────
  content = content.replace(/^[ \t]*\/\/\s*[═─]+[^\n]*\r?\n/gm, '');

  // Cleanup extra blank lines left by comment removal (more than 2 consecutive blank lines)
  content = content.replace(/\n{3,}/g, '\n\n');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Refactored: ${filePath}`);
  }
});
