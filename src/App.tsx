import { useState } from 'react';
import { FileUp, Download, RefreshCw, AlertCircle } from 'lucide-react';
import * as mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import markdownDocx, { Packer } from 'markdown-docx';

/**
 * Pre-process mammoth HTML for correct table conversion:
 * 1. Unwrap <p> inside table cells - mammoth outputs <td><p>X</p></td>, which turndown converts to
 *    paragraphs with extra newlines, breaking table layout and round-trip conversion.
 * 2. Convert first row <td> to <th> - turndown-plugin-gfm requires th to convert tables to markdown.
 */
function preprocessTableHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  doc.querySelectorAll('table td, table th').forEach((cell) => {
    cell.querySelectorAll('p').forEach((p) => {
      p.replaceWith(...Array.from(p.childNodes));
    });
  });
  doc.querySelectorAll('table').forEach((table) => {
    const firstRow = table.querySelector('tbody tr, thead tr, tr');
    if (firstRow && firstRow.querySelectorAll('td').length > 0 && !firstRow.querySelector('th')) {
      firstRow.querySelectorAll('td').forEach((td) => {
        const th = doc.createElement('th');
        th.innerHTML = td.innerHTML;
        td.replaceWith(th);
      });
    }
  });
  return doc.body.innerHTML;
}

type Tab = 'docx-to-md' | 'md-to-docx';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('docx-to-md');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [convertedContent, setConvertedContent] = useState<string | null>(null);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversionMessages, setConversionMessages] = useState<string[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setConvertedContent(null);
      setConvertedBlob(null);
      setError(null);
      setConversionMessages([]);
    }
  };

  const handleConvert = async () => {
    if (!uploadedFile) return;

    setIsConverting(true);
    setError(null);
    setConversionMessages([]);
    setConvertedContent(null);
    setConvertedBlob(null);

    try {
      if (activeTab === 'docx-to-md') {
        // DOCX to Markdown conversion
        const arrayBuffer = await uploadedFile.arrayBuffer();
        
        // Convert DOCX to HTML using mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const htmlWithTableHeaders = preprocessTableHtml(result.value);

        // Convert HTML to Markdown using turndown
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
        });
        turndownService.use(gfm);
        const markdown = turndownService.turndown(htmlWithTableHeaders);
        
        // Store conversion messages/warnings
        if (result.messages.length > 0) {
          const messages = result.messages.map(msg => msg.message);
          setConversionMessages(messages);
        }
        
        setConvertedContent(markdown);
      } else {
        // Markdown to DOCX conversion
        const markdownText = await uploadedFile.text();
        
        // Convert Markdown to DOCX using markdown-docx
        const doc = await markdownDocx(markdownText, {
          gfm: true,
          ignoreImage: false,
        });
        
        // Generate blob for download
        const blob = await Packer.toBlob(doc);
        setConvertedBlob(blob);
        setConvertedContent('DOCX file ready for download');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during conversion';
      setError(errorMessage);
      console.error('Conversion error:', err);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (activeTab === 'docx-to-md') {
      // Download Markdown file
      if (!convertedContent) return;
      
      const blob = new Blob([convertedContent], { 
        type: 'text/markdown' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = uploadedFile?.name.replace('.docx', '.md') || 'converted.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Download DOCX file
      if (!convertedBlob) return;
      
      const url = URL.createObjectURL(convertedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = uploadedFile?.name.replace('.md', '.docx') || 'converted.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleReset = () => {
    setUploadedFile(null);
    setConvertedContent(null);
    setConvertedBlob(null);
    setError(null);
    setConversionMessages([]);
  };

  const expectedFileType = activeTab === 'docx-to-md' ? '.docx' : '.md';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
            <h1 className="text-3xl font-bold text-white">Document Converter</h1>
            <p className="text-blue-100 mt-2">Convert between DOCX and Markdown formats</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => {
                setActiveTab('docx-to-md');
                handleReset();
              }}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'docx-to-md'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              DOCX → Markdown
            </button>
            <button
              onClick={() => {
                setActiveTab('md-to-docx');
                handleReset();
              }}
              className={`flex-1 px-6 py-4 font-medium transition-colors ${
                activeTab === 'md-to-docx'
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              Markdown → DOCX
            </button>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Upload Area */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload {activeTab === 'docx-to-md' ? 'DOCX' : 'Markdown'} File
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept={expectedFileType}
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <FileUp className="w-12 h-12 text-gray-400 mb-3" />
                  <span className="text-gray-600 mb-1">
                    Click to upload or drag and drop
                  </span>
                  <span className="text-sm text-gray-500">
                    {activeTab === 'docx-to-md' ? 'DOCX files only' : 'Markdown (.md) files only'}
                  </span>
                </label>
              </div>
              
              {uploadedFile && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                      <FileUp className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(uploadedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Conversion Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Conversion Messages/Warnings */}
            {conversionMessages.length > 0 && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 mb-2">Conversion Messages:</p>
                <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                  {conversionMessages.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Convert Button */}
            <button
              onClick={handleConvert}
              disabled={!uploadedFile || isConverting}
              className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                uploadedFile && !isConverting
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isConverting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Convert
                </>
              )}
            </button>

            {/* Preview Area */}
            {convertedContent && activeTab === 'docx-to-md' && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </label>
                <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                    {convertedContent}
                  </pre>
                </div>
              </div>
            )}

            {convertedContent && activeTab === 'md-to-docx' && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg text-center">
                <p className="text-green-800">
                  ✓ Conversion successful! Your DOCX file is ready to download.
                </p>
              </div>
            )}

            {/* Download Button */}
            {((activeTab === 'docx-to-md' && convertedContent) || (activeTab === 'md-to-docx' && convertedBlob)) && (
              <button
                onClick={handleDownload}
                className="w-full mt-4 py-3 px-6 bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
              >
                <Download className="w-5 h-5" />
                Download {activeTab === 'docx-to-md' ? 'Markdown' : 'DOCX'} File
              </button>
            )}
          </div>

          {/* Info Footer */}
          <div className="bg-gray-50 p-4 border-t">
            <p className="text-xs text-gray-600 text-center">
              <strong>Note:</strong> All conversions are performed entirely in your browser. 
              No data is sent to any server. Your files remain private and secure.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
