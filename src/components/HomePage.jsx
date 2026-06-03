import { useEffect, useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ImageIcon, Type, Search, Microscope, Volume2, Hash, Binary, ArrowRight } from './Icons';

gsap.registerPlugin(ScrollTrigger);

/* ── Section Data ── */
const SECTIONS = [
  {
    id: 'image',
    number: '01',
    Icon: ImageIcon,
    accentColor: '#14b8a6',
    title: 'Embed data into pixels',
    body: 'LSB encoding modifies the least significant bits of each pixel\u2019s red, green, and blue channels. A 1920\u00d71080 image can hide ~750KB of data with zero visible difference. Used in CTF challenges, digital watermarking, and covert communication research.',
    bullets: [
      'Supports variable bit depth (1\u20134 bits)',
      'Optional AES-256-GCM encryption',
      'PNG lossless only',
    ],
    cta: 'Open Image Tool',
    visual: {
      title: 'pixel_data.bin',
      lines: [
        { text: 'R: 11010110  \u2192  1101011', highlight: '1', suffix: '  (+1)' },
        { text: 'G: 10100011  \u2192  1010001', highlight: '0', suffix: '  (-1)' },
        { text: 'B: 01111000  \u2192  0111100', highlight: '1', suffix: '  (+1)' },
        { text: '' },
        { text: '\u0394 visual change: ', highlight: '0.0012%', suffix: '' },
        { text: 'Data embedded:  ', highlight: '3 bits', suffix: '' },
      ],
    },
  },
  {
    id: 'text',
    number: '02',
    Icon: Type,
    accentColor: '#06b6d4',
    title: 'Invisible inside plaintext',
    body: 'Zero-width Unicode characters (U+200B, U+200C, U+200D, U+FEFF) are completely invisible in rendered text but persist through copy-paste, emails, and web pages. Used by threat actors to fingerprint document leaks, embed covert identifiers in phishing lures, and hide payload URLs inside innocent strings.',
    bullets: null,
    cta: 'Open Text Tool',
    visual: {
      title: 'zero_width_demo.txt',
      lines: [
        { text: '"Hello World"', highlight: '', suffix: '' },
        { text: '' },
        { text: 'H\u00b7e\u00b7l\u00b7l\u00b7o\u00b7', highlight: '\u200b', suffix: '\u00b7W\u00b7o\u00b7r\u00b7l\u00b7d' },
        { text: '              \u2191     \u2191' },
        { text: '          U+200B  U+200C' },
        { text: '' },
        { text: 'Hidden payload: ', highlight: 'flag{st3g0}', suffix: '' },
      ],
    },
    reversed: true,
  },
  {
    id: 'metadata',
    number: '03',
    Icon: Search,
    accentColor: '#8b5cf6',
    title: 'Every file tells a story',
    body: 'EXIF data embedded in images contains GPS coordinates accurate to 3 meters, device serial numbers, timestamps, camera model, and software used. Used in OSINT investigations to geolocate photo sources, identify original authors of leaked documents, and trace device history across incidents.',
    bullets: null,
    cta: 'Open Metadata Tool',
    visual: {
      title: 'EXIF \u2014 IMG_3847.jpg',
      lines: [
        { text: 'Camera:   ', highlight: 'Canon EOS R5', suffix: '' },
        { text: 'GPS:      ', highlight: '37.7749\u00b0 N, 122.4194\u00b0 W', suffix: '' },
        { text: 'DateTime: ', highlight: '2024-03-15 14:23:07', suffix: '' },
        { text: 'Software: ', highlight: 'Adobe Photoshop 25.3', suffix: '' },
        { text: 'Serial:   ', highlight: '032024000847', suffix: '' },
        { text: '' },
        { text: '\u26a0 Location data ', highlight: 'EXPOSED', suffix: '' },
      ],
    },
  },
  {
    id: 'analysis',
    number: '04',
    Icon: Microscope,
    accentColor: '#f59e0b',
    title: 'Detect what\u2019s hidden',
    body: 'Chi-square analysis detects LSB steganography by measuring statistical anomalies in pixel value distributions \u2014 clean images follow natural frequency curves, stego images show unnaturally flat distributions. Bit-plane extraction reveals hidden patterns invisible to the naked eye. Used in digital forensics, malware analysis, and CTF solving.',
    bullets: null,
    cta: 'Open Steganalysis Tool',
    visual: {
      title: 'chi_square_analysis.log',
      lines: [
        { text: 'Chi-Square Analysis' },
        { text: '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500' },
        { text: 'Clean: \u2588\u2588\u2588\u2588\u2593\u2593\u2592\u2591\u2591    ', highlight: 'p=0.847', suffix: '' },
        { text: 'Stego: \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591    ', highlight: 'p=0.003 \u26a0', suffix: '' },
        { text: '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500' },
        { text: 'Detection:  ', highlight: 'POSITIVE', suffix: '' },
        { text: 'Confidence: ', highlight: '99.7%', suffix: '' },
      ],
    },
    reversed: true,
  },
  {
    id: 'audio',
    number: '05',
    Icon: Volume2,
    accentColor: '#ec4899',
    title: 'Hidden in the waveform',
    body: 'LSB encoding in WAV audio modifies the least significant bit of each audio sample. Human hearing cannot detect changes below -90dB. A 3-minute WAV file at 44.1kHz can conceal over 5MB of data. Used in covert channels, watermarking audio for leak detection, and CTF audio challenges.',
    bullets: null,
    cta: 'Open Audio Tool',
    visual: {
      title: 'waveform_analysis \u2014 track.wav',
      lines: [
        { text: 'Sample Rate:  ', highlight: '44100 Hz', suffix: '' },
        { text: 'Bit Depth:    ', highlight: '16-bit', suffix: '' },
        { text: 'LSB Modified: ', highlight: 'Samples 0\u2013441000', suffix: '' },
        { text: 'Capacity:     ', highlight: '5.3 MB', suffix: '' },
        { text: 'SNR Impact:   ', highlight: '-91.2 dB', suffix: '' },
        { text: '' },
        { text: '\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2593\u2592\u2591\u2591\u2592\u2593\u2588\u2588\u2593\u2592\u2591\u2592\u2593\u2588\u2593\u2592' },
      ],
    },
  },
  {
    id: 'hash',
    number: '06',
    Icon: Hash,
    accentColor: '#10b981',
    title: 'Verify file integrity',
    body: 'Compute cryptographic hashes (MD5, SHA-1, SHA-256, SHA-512) for any file entirely in your browser. Compare two files to check if they are identical, or verify a download against a known hash. Used in forensics to prove evidence integrity, in software distribution to verify downloads, and in incident response to identify known malware samples.',
    bullets: null,
    cta: 'Open Hash Tool',
    visual: {
      title: 'hash_verify.log',
      lines: [
        { text: 'File:    ', highlight: 'evidence_img.dd', suffix: '' },
        { text: 'MD5:     ', highlight: 'd41d8cd98f00b204e980', suffix: '' },
        { text: 'SHA-256: ', highlight: 'e3b0c44298fc1c149afb', suffix: '' },
        { text: '' },
        { text: 'Verify:  ', highlight: '\u2705 MATCH', suffix: '' },
      ],
    },
    reversed: true,
  },
  {
    id: 'hex',
    number: '07',
    Icon: Binary,
    accentColor: '#f97316',
    title: 'Inspect raw bytes',
    body: 'View the hex dump of any file with a classic offset-hex-ASCII layout. Search for byte patterns, jump to specific offsets, and auto-detect file signatures. Used in reverse engineering, malware analysis, CTF binary challenges, and understanding file format internals at the byte level.',
    bullets: null,
    cta: 'Open Hex Tool',
    visual: {
      title: 'hexdump \u2014 image.png',
      lines: [
        { text: '00000000  ', highlight: '89 50 4E 47', suffix: ' 0D 0A 1A 0A' },
        { text: '00000008  00 00 00 0D 49 48 44 52' },
        { text: '00000010  00 00 04 00 00 00 03 00' },
        { text: '' },
        { text: 'Detected: ', highlight: 'PNG Image', suffix: '' },
        { text: 'Signature: ', highlight: '89 50 4E 47', suffix: '' },
      ],
    },
  },
];

/* ── Terminal Visual Component ── */
function TerminalVisual({ data, accentColor }) {
  return (
    <div className="landing-terminal" style={{ '--terminal-accent': accentColor }}>
      <div className="landing-terminal-header">
        <span className="landing-terminal-dot" />
        <span className="landing-terminal-dot" />
        <span className="landing-terminal-dot" />
        <span className="landing-terminal-title">{data.title}</span>
      </div>
      <div className="landing-terminal-body">
        {data.lines.map((line, i) => (
          <div key={i} className="landing-terminal-line">
            {line.text && <span>{line.text}</span>}
            {line.highlight && (
              <span className="landing-terminal-hl">{line.highlight}</span>
            )}
            {line.suffix && <span>{line.suffix}</span>}
            {!line.text && !line.highlight && <br />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Scroll Indicator Arrow ── */
function ScrollIndicator() {
  return (
    <div className="scroll-indicator">
      <span className="scroll-indicator-text">Scroll to explore</span>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    </div>
  );
}

/* ── Main HomePage Component ── */
export default function HomePage({ setActiveTab }) {
  const containerRef = useRef(null);

  // GSAP scroll-triggered animations
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Animate all .landing-animate elements
      gsap.utils.toArray('.landing-animate').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              end: 'top 50%',
              toggleActions: 'play none none none',
            },
          }
        );
      });

      // Stagger terminal lines
      gsap.utils.toArray('.landing-terminal').forEach((terminal) => {
        const lines = terminal.querySelectorAll('.landing-terminal-line');
        gsap.fromTo(
          lines,
          { opacity: 0, x: -10 },
          {
            opacity: 1,
            x: 0,
            duration: 0.4,
            stagger: 0.07,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: terminal,
              start: 'top 80%',
              toggleActions: 'play none none none',
            },
          }
        );
      });

      // Hero content fade in
      gsap.fromTo(
        '.landing-hero-content',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.2 }
      );

      // Intro columns stagger
      gsap.fromTo(
        '.landing-intro-col',
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.landing-intro',
            start: 'top 75%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="landing-page">
      {/* ════════════ HERO ════════════ */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            Client-side &middot; No data leaves your browser
          </div>
          <h1 className="landing-hero-title">StegaCrypt</h1>
          <p className="landing-hero-subtitle">
            Hide anything. Find everything.
          </p>
        </div>
        <ScrollIndicator />
      </section>

      {/* ════════════ INTRO ════════════ */}
      <section className="landing-intro">
        <div className="landing-section-inner">
          <h2 className="landing-animate">
            Steganography in the real world
          </h2>
          <div className="landing-intro-grid">
            <div className="landing-intro-col">
              <h3>How it works</h3>
              <p>
                LSB (Least Significant Bit) encoding changes the last bit of a
                pixel&rsquo;s RGB value &mdash; a modification so small it&rsquo;s
                completely imperceptible to the human eye. An image that looks
                identical can carry kilobytes of hidden data, encoded one bit at
                a time across millions of color channels.
              </p>
            </div>
            <div className="landing-intro-col">
              <h3>Why it matters</h3>
              <p>
                Malware uses steganography to hide C2 commands inside innocent
                images posted on social media. Journalists watermark leaked
                documents with invisible fingerprints to trace sources. CTF
                challenges hide flags inside audio and image files, requiring
                bit-level forensics to extract. Understanding steganography is
                essential to modern security.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ TOOL SECTIONS ════════════ */}
      {SECTIONS.map((section) => (
        <section
          key={section.id}
          className={`landing-section ${section.reversed ? 'landing-section--reversed' : ''}`}
          style={{ '--section-accent': section.accentColor }}
          data-nav-theme={section.id}
        >
          <div className="landing-section-accent-line" />
          <div className="landing-section-inner">
            <span className="landing-section-number">{section.number}</span>
            <div className="landing-section-grid">
              <div className="landing-section-text">
                <div className="landing-section-icon landing-animate">
                  <section.Icon size={20} />
                </div>
                <h2 className="landing-animate">{section.title}</h2>
                <p className="landing-animate">{section.body}</p>
                {section.bullets && (
                  <ul className="landing-section-bullets landing-animate">
                    {section.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                <button
                  className="landing-cta landing-animate"
                  onClick={() => setActiveTab(section.id)}
                >
                  {section.cta} <ArrowRight size={16} />
                </button>
              </div>
              <div className="landing-section-visual landing-animate">
                <TerminalVisual
                  data={section.visual}
                  accentColor={section.accentColor}
                />
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ════════════ FOOTER STRIP ════════════ */}
      <section className="landing-footer-strip">
        <div className="landing-section-inner">
          <div className="landing-footer-links landing-animate">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className="landing-footer-link"
                style={{ '--link-accent': s.accentColor }}
                onClick={() => setActiveTab(s.id)}
              >
                <s.Icon size={14} />
                {s.cta.replace('Open ', '').replace(' Tool', '')}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
