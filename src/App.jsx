import { useState } from 'react';
import ImageStego from './components/ImageStego';
import TextStego from './components/TextStego';
import MetadataViewer from './components/MetadataViewer';
import Steganalysis from './components/Steganalysis';
import { Shield, ImageIcon, Type, Search, Microscope, Menu, X, ArrowRight, Layers } from './components/Icons';
import './index.css';

const TABS = [
  { id: 'home', label: 'Home', Icon: null },
  { id: 'image', label: 'Image', Icon: ImageIcon },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'metadata', label: 'Metadata', Icon: Search },
  { id: 'analysis', label: 'Analysis', Icon: Microscope },
];

function Navbar({ activeTab, setActiveTab }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <a className="navbar-logo" href="#" onClick={(e) => { e.preventDefault(); setActiveTab('home'); }}>
          <div className="navbar-logo-icon">
            <Shield size={18} />
          </div>
          <div className="navbar-logo-text">
            <span>StegaCrypt</span>
          </div>
        </a>

        <div className={`navbar-tabs ${mobileOpen ? 'open' : ''}`}>
          {TABS.filter(t => t.id !== 'home').map((tab) => (
            <button
              key={tab.id}
              className={`navbar-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setMobileOpen(false); }}
            >
              <tab.Icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <button
          className="navbar-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </nav>
  );
}

function Hero({ setActiveTab }) {
  const features = [
    {
      Icon: ImageIcon,
      title: 'Image Steganography',
      desc: 'Embed data into image pixels using LSB encoding. Supports variable bit depth and optional encryption.',
      tab: 'image',
      accent: 'var(--accent-cyan)',
    },
    {
      Icon: Type,
      title: 'Text Steganography',
      desc: 'Conceal messages within ordinary text using zero-width Unicode characters. Completely invisible.',
      tab: 'text',
      accent: 'var(--accent-green)',
    },
    {
      Icon: Search,
      title: 'Metadata Extraction',
      desc: 'Parse EXIF data from images — camera details, GPS coordinates, timestamps, and software metadata.',
      tab: 'metadata',
      accent: 'var(--accent-purple)',
    },
    {
      Icon: Microscope,
      title: 'Steganalysis',
      desc: 'Detect hidden payloads through bit plane extraction, chi-square statistical tests, and visual attacks.',
      tab: 'analysis',
      accent: 'var(--accent-orange)',
    },
  ];

  return (
    <section className="hero">
      <div className="hero-badge">
        <span className="hero-badge-dot" />
        Client-side processing — no data leaves your browser
      </div>
      <h1>
        Steganography<br />
        <span className="gradient-text">Toolkit</span>
      </h1>
      <p className="hero-subtitle">
        Encode, decode, and analyze hidden data in images and text.
        Built for security researchers, CTF players, and anyone interested in information hiding.
      </p>

      <div className="feature-cards stagger-children">
        {features.map((f) => (
          <div
            key={f.tab}
            className="feature-card"
            onClick={() => setActiveTab(f.tab)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab(f.tab)}
          >
            <div className="feature-card-icon" style={{ color: f.accent, background: `color-mix(in srgb, ${f.accent} 12%, transparent)` }}>
              <f.Icon size={22} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            <span className="feature-card-link">
              Open tool <ArrowRight size={14} />
            </span>
          </div>
        ))}
      </div>

      <div className="hero-tech-bar">
        <Layers size={14} />
        <span>React</span>
        <span className="dot" />
        <span>Canvas API</span>
        <span className="dot" />
        <span>Web Crypto</span>
        <span className="dot" />
        <span>Zero Dependencies</span>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <p>
        StegaCrypt &middot; Built for <strong>Nebula</strong> by MDG Space &middot; All processing runs locally in your browser
      </p>
    </footer>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Hero setActiveTab={setActiveTab} />;
      case 'image':
        return <ImageStego />;
      case 'text':
        return <TextStego />;
      case 'metadata':
        return <MetadataViewer />;
      case 'analysis':
        return <Steganalysis />;
      default:
        return <Hero setActiveTab={setActiveTab} />;
    }
  };

  return (
    <>
      <div className="app-background" />
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main style={{ flex: 1 }}>
        {renderContent()}
      </main>
      <Footer />
    </>
  );
}
