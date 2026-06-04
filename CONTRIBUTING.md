# Contributing to StegaCrypt

Thank you for your interest in contributing! StegaCrypt is a browser-based steganography toolkit built with React + Vite - zero backend, all client-side.

## Development Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-username>/stegacrypt.git
cd stegacrypt

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
# App runs at http://localhost:5173/
```

## Project Structure

```
src/
├── components/       # React UI components
│   ├── Icons.jsx     # Inline SVG icon library
│   ├── ImageStego.jsx
│   ├── TextStego.jsx
│   ├── MetadataViewer.jsx
│   ├── Steganalysis.jsx
│   └── AudioStego.jsx
├── utils/            # Core algorithms (no UI)
│   ├── lsb.js        # LSB image steganography
│   ├── textStego.js  # Zero-width character encoding
│   ├── exif.js       # EXIF metadata parser
│   ├── analysis.js   # Steganalysis algorithms
│   └── audioStego.js # WAV audio steganography
├── App.jsx           # Navigation + layout
├── main.jsx          # Entry point
└── index.css         # Design system
```

## Coding Guidelines

- **No external runtime dependencies** - all algorithms must work with native browser APIs only (Canvas, WebAudio, FileReader, etc.)
- **Pure utility functions** - keep `src/utils/` free of React. Each file exports named functions only.
- **CSS custom properties** - always use the design tokens from `:root` in `index.css` rather than hardcoded values.
- **No TypeScript** - the project uses plain JSX. Keep it consistent.
- **Document your functions** - use JSDoc comments on all exported functions in `src/utils/`.

## How to Submit Changes

1. Create a new branch: `git checkout -b feat/your-feature-name`
2. Make your changes and test them manually in Chrome and Firefox
3. Run the linter: `npm run lint`
4. Commit with a descriptive message: `git commit -m "feat: add XYZ support"`
5. Push and open a Pull Request against `main`

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use for |
|--------|---------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `style:` | CSS/formatting, no logic change |
| `refactor:` | Code restructure, no behavior change |
| `perf:` | Performance improvement |
| `chore:` | Build/tooling/config changes |

## Reporting Bugs

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) issue template.

## Suggesting Features

Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) issue template.

## License

By contributing, you agree your contributions will be licensed under the [MIT License](LICENSE).
