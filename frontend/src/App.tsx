import { useState, useEffect, useCallback } from 'react';
import { EditorProvider, useEditor } from './context/EditorContext';
import { Sidebar } from './components/Sidebar';
import { Inspector } from './components/Inspector';
import { Preview } from './components/Preview';
import { Download, Copy, Check } from 'lucide-react';
import { stripIds } from './utils';

function Layout() {
  const { data } = useEditor();
  const [copied, setCopied] = useState(false);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(320);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Resize handlers
  const startResizingLeft = useCallback(() => setIsResizingLeft(true), []);
  const startResizingRight = useCallback(() => setIsResizingRight(true), []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        setLeftWidth(Math.max(200, Math.min(600, e.clientX)));
      }
      if (isResizingRight) {
        setRightWidth(Math.max(200, Math.min(600, window.innerWidth - e.clientX)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none'; // Prevent text selection
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight]);




  const handleCopyJson = () => {
    const cleanData = stripIds(data);
    navigator.clipboard.writeText(JSON.stringify(cleanData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportFile = () => {
    const cleanData = stripIds(data);
    const jsonString = JSON.stringify(cleanData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.name || 'form_layout'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden selection:bg-blue-100 selection:text-blue-900">
      {/* Left Sidebar: Tree View */}
      <div
        className="bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm relative group"
        style={{ width: leftWidth, minWidth: leftWidth }}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-blue-500/20 shadow-lg">
              JE
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-800 leading-tight">JSON Editor</h1>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Builder</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          <Sidebar />
        </div>

        {/* Resizer Handle */}
        <div
          className="absolute top-0 right-0 w-4 h-full cursor-col-resize hover:bg-blue-500/10 transition-colors z-50 translate-x-[50%] bg-transparent"
          onMouseDown={startResizingLeft}
        />
      </div>

      {/* Middle: Canvas / Preview */}
      <div className="flex-1 bg-slate-50/50 relative overflow-hidden flex flex-col min-w-0">
        {/* Dot Grid Background */}
        <div className="absolute inset-0 z-0 opacity-[0.4]"
          style={{
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

        <div className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-400">Canvas Mode</span>
            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium border border-blue-100">Interactive</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
            <button
              onClick={handleExportFile}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export File
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 z-0 flex flex-col items-center">
          <div className="w-full max-w-6xl transition-all duration-300">
            <Preview />
          </div>
        </div>
      </div>

      {/* Right Sidebar: Inspector */}
      <div
        className="bg-white border-l border-slate-200 flex flex-col z-20 shadow-sm relative group"
        style={{ width: rightWidth, minWidth: rightWidth }}
      >
        {/* Resizer Handle (Left Side of Right Sidebar) */}
        <div
          className="absolute top-0 left-0 w-4 h-full cursor-col-resize hover:bg-blue-500/10 transition-colors z-50 translate-x-[-50%] bg-transparent"
          onMouseDown={startResizingRight}
        />

        <div className="h-16 flex items-center px-6 border-b border-slate-100 bg-white">
          <h2 className="font-semibold text-sm text-slate-800">Properties</h2>
        </div>
        <div className="flex-1 overflow-auto p-0">
          <Inspector />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <EditorProvider>
      <Layout />
    </EditorProvider>
  );
}

export default App;
