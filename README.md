# Docx Markdown Converter App

A fully functional, offline document converter that converts between DOCX and Markdown formats entirely in your browser. No backend required - all processing happens client-side for maximum privacy and security.

## Features

- **DOCX → Markdown**: Convert Word documents to Markdown format (including tables as GFM)
- **Markdown → DOCX**: Convert Markdown files to Word documents
- **100% Offline**: All conversions happen in your browser - no data is sent to any server
- **Privacy-First**: Your files never leave your device
- **Real-Time Conversion**: Fast, client-side processing using industry-standard libraries
- **Error Handling**: Clear error messages and conversion warnings
- **Modern UI**: Clean, responsive interface built with React and Tailwind CSS

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **mammoth.js** - DOCX to HTML conversion
- **turndown** - HTML to Markdown conversion
- **turndown-plugin-gfm** - GFM extensions (tables, strikethrough, task lists)
- **markdown-docx** - Markdown to DOCX conversion

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository or extract the project files
2. Install dependencies:

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The application will open at `http://localhost:3000`

### Build

Create a production build:

```bash
npm run build
```

The built files will be in the `build` directory.

## Usage

1. **Select Conversion Direction**: Choose either "DOCX → Markdown" or "Markdown → DOCX" using the tabs
2. **Upload File**: Click the upload area or drag and drop your file
3. **Convert**: Click the "Convert" button to process your file
4. **Preview** (DOCX → Markdown): Review the converted Markdown in the preview area
5. **Download**: Click the "Download" button to save the converted file

## How It Works

### DOCX to Markdown
1. The DOCX file is read as an ArrayBuffer
2. `mammoth.js` converts the DOCX structure to HTML
3. HTML is pre-processed (table cells unwrapped, header rows normalized) for correct GFM output
4. `turndown` with `turndown-plugin-gfm` converts the HTML to Markdown (including tables)
5. The result is displayed and available for download

### Markdown to DOCX
1. The Markdown file is read as text
2. `markdown-docx` parses the Markdown and generates a DOCX document
3. The DOCX file is generated as a blob and available for download

## Privacy & Security

- **No Backend**: All processing happens in your browser
- **No Network Calls**: No data is transmitted over the internet
- **No Storage**: Files are processed in memory and not stored anywhere
- **Open Source**: You can inspect the code to verify privacy claims

## Browser Support

Works in all modern browsers that support:
- ES2020 features
- File API
- Blob API
- ArrayBuffer

## License

This project is private and not licensed for redistribution.

## Original Design

Based on the design from: https://www.figma.com/design/K4mKmEm8JCKnQWUkiuEaID/Docx-Markdown-Converter-App
