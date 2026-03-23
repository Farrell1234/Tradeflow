import { useState, useRef } from 'react';
import { analyzeScript } from '../../api';
import { useToast } from '../Toast';

export default function ScriptUploader({ algoId, onAnalysisComplete }) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedCode, setPastedCode] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const toast = useToast();

  function readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  async function handleAnalyze(content, filename) {
    if (!content || !content.trim()) {
      toast.error('Please upload a .pine file or paste your script first.');
      return;
    }
    setLoading(true);
    try {
      const result = await analyzeScript(content, filename, algoId);
      onAnalysisComplete(result, result.scriptId, content, filename);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to analyze script.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setSelectedFile(file);
  }

  async function handleFileInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
  }

  async function handleSubmit() {
    if (pasteMode) {
      await handleAnalyze(pastedCode, 'pasted_script.pine');
    } else if (selectedFile) {
      const content = await readFileContent(selectedFile);
      await handleAnalyze(content, selectedFile.name);
    } else {
      toast.error('Please upload a .pine file or paste your script.');
    }
  }

  const canSubmit = pasteMode ? pastedCode.trim().length > 0 : !!selectedFile;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'wizard-step-in 0.35s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>
            Upload Your Indicator
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Drop your .pine file or paste the code — TradeFlow will read it and guide the rest of setup.
          </p>
        </div>
        <button
          onClick={() => { setPasteMode(m => !m); setSelectedFile(null); setPastedCode(''); }}
          className="btn btn-ghost btn-sm"
          style={{ whiteSpace: 'nowrap' }}
        >
          {pasteMode ? '↑ Upload file instead' : '⌨ Paste code instead'}
        </button>
      </div>

      {!pasteMode ? (
        <div
          className="glass"
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            borderRadius: 14,
            padding: '48px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            border: `1px dashed ${dragging ? 'var(--blue)' : selectedFile ? 'rgba(0,230,118,0.5)' : 'rgba(255,255,255,0.15)'}`,
            background: dragging ? 'rgba(77,159,255,0.05)' : 'var(--bg-card)',
            transition: 'border-color 0.2s, background 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pine"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          {selectedFile ? (
            <div>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
              <div style={{ fontWeight: 600, color: 'var(--green)', fontSize: 15 }}>{selectedFile.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {(selectedFile.size / 1024).toFixed(1)} KB — click to change
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📄</div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 14 }}>
                Drop your .pine file here
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                or click to browse — TradingView Pine Script v5 supported
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glass" style={{ borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>
            PASTE PINE SCRIPT
          </div>
          <textarea
            value={pastedCode}
            onChange={e => setPastedCode(e.target.value)}
            placeholder={`//@version=5\nindicator("My Indicator", overlay=true)\n...`}
            className="mono"
            style={{
              width: '100%', minHeight: 260, resize: 'vertical',
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-main)', fontSize: 12,
              padding: '12px 14px', outline: 'none', fontFamily: 'JetBrains Mono, monospace',
              lineHeight: 1.7,
            }}
          />
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
        className="btn btn-primary"
        style={{
          padding: '14px 28px', fontSize: 14, fontWeight: 700,
          animation: loading ? 'pulse-glow-blue 1.4s ease-in-out infinite' : 'none',
          opacity: canSubmit && !loading ? 1 : 0.5,
          cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
        }}
      >
        {loading ? 'Analyzing your script…' : 'Analyze Script →'}
      </button>
    </div>
  );
}
