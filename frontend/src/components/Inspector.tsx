import React, { useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { stripIds } from '../utils';
import { Copy, Check } from 'lucide-react';

export const Inspector = () => {
    const { selectedNode, updateNode } = useEditor();
    const [copied, setCopied] = useState(false);

    if (!selectedNode) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl opacity-20">⚙️</span>
                </div>
                <p className="text-sm">Select an element to edit properties</p>
            </div>
        );
    }

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateNode({ ...selectedNode, name: e.target.value });
    };

    const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateNode({ ...selectedNode, width: parseInt(e.target.value) || 12 });
    };

    const handleCopyDebug = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const cleanNode = stripIds(selectedNode);
        navigator.clipboard.writeText(JSON.stringify(cleanNode, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Type</h3>
                <p className="font-mono text-sm font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded border border-blue-100">{selectedNode.type}</p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">Display Name</label>
                    <input
                        type="text"
                        value={selectedNode.name || ''}
                        onChange={handleNameChange}
                        className="input-field w-full"
                        placeholder="Element Name"
                    />
                </div>

                {selectedNode.type !== 'FORM' && selectedNode.type !== 'TAB' && (
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">Grid Width (1-12)</label>
                        <input
                            type="number"
                            min="1"
                            max="12"
                            value={selectedNode.width || 12}
                            onChange={handleWidthChange}
                            className="input-field w-full"
                        />
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${((selectedNode.width || 12) / 12) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-6 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 ml-1">Additional Properties</h3>
                <div className="space-y-3">
                    {Object.entries(selectedNode).map(([key, value]) => {
                        if (['name', 'width', 'type', 'contents', 'tabs', 'rows', 'id'].includes(key)) return null;
                        return (
                            <div key={key}>
                                <label className="block text-[10px] font-medium text-slate-500 mb-1 ml-1 uppercase">{key}</label>
                                <input
                                    type="text"
                                    value={String(value)}
                                    readOnly
                                    className="input-field w-full bg-slate-50/50 text-slate-500 cursor-not-allowed"
                                />
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="pt-6 mt-8 border-t border-slate-100">
                <details className="group" open>
                    <summary className="flex items-center justify-between cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors list-none select-none">
                        <div className="flex items-center">
                            <span className="mr-2 transform group-open:rotate-90 transition-transform">▶</span>
                            Debug JSON
                        </div>
                        <button
                            onClick={handleCopyDebug}
                            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-slate-500 bg-white border border-slate-100 rounded hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm"
                            title="Copy JSON"
                        >
                            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                    </summary>
                    <div className="mt-3 p-3 bg-slate-900 rounded-lg overflow-hidden relative group/code">
                        <pre className="text-[10px] text-slate-300 font-mono overflow-auto max-h-40 custom-scrollbar">
                            {JSON.stringify(stripIds(selectedNode), null, 2)}
                        </pre>
                    </div>
                </details>
            </div>
        </div>
    );
};
