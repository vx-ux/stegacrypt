# StegaCrypt

> A browser-based steganography toolkit. No server. No telemetry. No exceptions.

![React](https://img.shields.io/badge/react-18.0-61DAFB?style=flat-square&logo=react)

StegaCrypt is a client-side steganography toolkit that runs entirely within the browser. It supports embedding and extracting hidden payloads in image and audio files, optional AES-256-GCM encryption of those payloads, and statistical steganalysis for detecting hidden data. Every operation - file processing, encoding, decryption - executes locally via native browser APIs. Nothing is transmitted externally.

---

## Features

- **LSB Image Steganography** - Embed and extract payloads in PNG and BMP files by manipulating the least significant bits of RGB pixel channels.
- **LSB Audio Steganography** - Conceal and retrieve data within WAV audio files by modifying the least significant bit of individual audio samples.
- **Chi-Square Steganalysis** - Detect the presence of hidden data by testing pixel value distributions against expected natural frequency curves.
- **AES-256-GCM Encryption** - Encrypt payloads before embedding using a PBKDF2-derived key with a random 16-byte salt and 310,000 iterations, providing authenticated confidentiality.
- **Complete Client-Side Execution** - All processing occurs locally via the Canvas API, Web Audio API, Web Crypto API, and File API.

---

## How It Works

**Image Steganography** modifies the least significant bits of the red, green, and blue channels in an image. Because the alterations are confined to the lowest-order bits, the visual difference remains imperceptible to the human eye.

**Audio Steganography** applies the same LSB technique to audio sample bytes within a WAV file. Modifications to the least significant bit of each sample produce amplitude variations that fall below the threshold of human hearing.

**Chi-Square Steganalysis** tests the statistical properties of an image against expected natural distributions. Clean images exhibit typical frequency curves; images containing LSB-encoded data produce unnaturally flat distributions that the test surfaces.

**AES-256-GCM Encryption** wraps the payload in authenticated encryption before it is embedded. The key is derived from a user-supplied password via PBKDF2, ensuring that even if a stego file is discovered, its contents remain confidential and tamper-evident.

---

## Getting Started

### Prerequisites

- Node.js v16 or higher
- npm or yarn

### Installation

```bash
git clone https://github.com/vx-ux/stegacrypt.git
cd stegacrypt
npm install
```

### Running the Application

```bash
npm run dev
```

Navigate to `http://localhost:5173` in your browser.

---

## Usage

### Encoding Data

1. Open the Image or Audio steganography tool.
2. Select the **Encode** mode.
3. Upload a target file - PNG, BMP, or WAV.
4. Enter the payload in the text field.
5. Optionally, provide a password to encrypt the payload with AES-256-GCM.
6. Click **Encode** and download the resulting stego file.

### Decoding Data

1. Open the relevant steganography tool.
2. Select the **Decode** mode.
3. Upload the file containing the embedded payload.
4. Provide the decryption password if the payload was encrypted.
5. Click **Decode** to extract the hidden message.

---

## Workflows

### Image Encoding

```mermaid
graph LR
    A[Input Image] --> B[Read Pixels]
    B --> C[Inject Message Bits]
    C --> D[Stego PNG]
```

### Image Decoding

```mermaid
graph LR
    A[Stego Image] --> B[Read Pixels]
    B --> C[Extract LSBs]
    C --> D[Plaintext Message]
```

### Audio Encoding

```mermaid
graph LR
    A[Input WAV] --> B[Read Samples]
    B --> C[Inject Message Bits]
    C --> D[Stego WAV]
```

### Audio Decoding

```mermaid
graph LR
    A[Stego WAV] --> B[Read Samples]
    B --> C[Extract LSBs]
    C --> D[Plaintext Message]
```

### Steganalysis

```mermaid
graph LR
    A[Input Image] --> B[Pixel Frequencies]
    B --> C{Chi-Square Test}
    C -- Pass --> D[Clean]
    C -- Fail --> E[Payload Detected]
```

---

## Project Structure

```text
src/
├── components/       # React UI components
├── utils/            # Steganography, cryptography, and analysis logic
├── workers/          # Web Workers for off-thread processing
├── App.jsx           # Main application component
├── index.css         # Global stylesheets
└── main.jsx          # React entry point
```

---

## Security

StegaCrypt operates entirely within the client environment. No files, passwords, or payloads are transmitted to any external server. All processing is handled by the Canvas API, Web Audio API, and Web Crypto API.

When a password is supplied, the payload is encrypted with AES-256-GCM before embedding. The encryption key is derived via PBKDF2 using a randomly generated 16-byte salt and 310,000 iterations. This scheme provides authenticated encryption, guaranteeing both the confidentiality and integrity of the hidden payload.

---
