import { useState, useEffect, useRef } from 'react';
import ImageStego from './components/ImageStego';
import TextStego from './components/TextStego';
import MetadataViewer from './components/MetadataViewer';
import Steganalysis from './components/Steganalysis';
import ErrorBoundary from './components/ErrorBoundary';
import AudioStego from './components/AudioStego';
import ShiftBackground from './components/ShiftBackground';
import HomePage from './components/HomePage';
import { Shield, ImageIcon, Type, Search, Microscope, Volume2, Menu, X } from './components/Icons';
import './index.css';

const TABS = [
  { id: 'home', label: 'Home', Icon: null },
  { id: 'image', label: 'Image', Icon: ImageIcon },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'audio', label: 'Audio', Icon: Volume2 },
  { id: 'metadata', label: 'Metadata', Icon: Search },
  { id: 'analysis', label: 'Analysis', Icon: Microscope },
];

// Section-based nav accent colors
const NAV_THEMES = {
  home:     { accent: '#06b6d4', glow: 'rgba(6, 182, 212, 0.3)' },
  image:    { accent: '#06b6d4', glow: 'rgba(6, 182, 212, 0.3)' },
  text:     { accent: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
  audio:    { accent: '#ec4899', glow: 'rgba(236, 72, 153, 0.3)' },
  metadata: { accent: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.3)' },
  analysis: { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)' },
};

function Navbar({ activeTab, setActiveTab }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);

  // Scroll-aware bottom border
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Section-based nav theme — update CSS custom properties
  useEffect(() => {
    const theme = NAV_THEMES[activeTab] || NAV_THEMES.home;
    const root = document.documentElement;
    root.style.setProperty('--nav-accent', theme.accent);
    root.style.setProperty('--nav-accent-glow', theme.glow);
  }, [activeTab]);

  return (
    <nav ref={navRef} className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-inner">
        <a className="navbar-logo" href="#" onClick={(e) => { e.preventDefault(); setActiveTab('home'); }}>
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

function Footer() {
  return (
    <footer className="footer">
      <p>
        StegaCrypt &middot; All processing runs locally in your browser &middot; No data ever leaves your machine
      </p>
    </footer>
  );
}

export default function App() {
  const getHashTab = () => {
    const hash = window.location.hash.replace('#', '');
    return TABS.some(t => t.id === hash) ? hash : 'home';
  };

  const [activeTab, setActiveTabState] = useState(getHashTab());

  useEffect(() => {
    const handleHashChange = () => {
      setActiveTabState(getHashTab());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const setActiveTab = (tabId) => {
    if (tabId === 'home') {
      window.history.pushState(null, '', window.location.pathname);
      setActiveTabState('home');
    } else {
      window.location.hash = tabId;
    }
    // Scroll to top on tab change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomePage setActiveTab={setActiveTab} />;
      case 'image':
        return <ErrorBoundary key="image"><ImageStego /></ErrorBoundary>;
      case 'text':
        return <ErrorBoundary key="text"><TextStego /></ErrorBoundary>;
      case 'audio':
        return <ErrorBoundary key="audio"><AudioStego /></ErrorBoundary>;
      case 'metadata':
        return <ErrorBoundary key="metadata"><MetadataViewer /></ErrorBoundary>;
      case 'analysis':
        return <ErrorBoundary key="analysis"><Steganalysis /></ErrorBoundary>;
      default:
        return <HomePage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <>
      <ShiftBackground />
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main data-nav-theme={activeTab} style={{ flex: 1 }}>
        {renderContent()}
      </main>
      <Footer />
    </>
  );
}
