import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useEditor } from '../context/EditorContext';
import { useToast } from './ToastProvider';


export const JsonImporter = () => {
    const { setFromJson } = useEditor();
    const { addToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isPasteOpen, setIsPasteOpen] = useState(false);
    const [pasteText, setPasteText] = useState('');

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            if (typeof text !== 'string') {
                throw new TypeError('Unable to read file contents.');
            }
            const parsed = JSON.parse(text);
            setFromJson(parsed);
            addToast('JSON import complete', 'success');
        } catch (err) {
            console.error('Failed to import JSON layout:', err);
            addToast('JSON import failed', 'error');
        }
        event.target.value = '';
    };

    const handlePasteImport = () => {
        try {
            const parsed = JSON.parse(pasteText);
            setFromJson(parsed);
            addToast('JSON import complete', 'success');
            setIsPasteOpen(false);
            setPasteText('');
        } catch (err) {
            console.error('Failed to import pasted JSON:', err);
            addToast('JSON import failed', 'error');
        }
    };

    return (
        <div className="flex flex-col gap-1">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".json,application/json"
                className="hidden"
            />
            <div className="flex items-center gap-2">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-sm transition-colors"
                >
                    <Upload className="w-3.5 h-3.5" />
                    Import JSON
                </button>
                <button
                    onClick={() => setIsPasteOpen(true)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded shadow-sm hover:bg-slate-50 transition-colors"
                >
                    Paste JSON
                </button>
            </div>

            {isPasteOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-w-[92vw] overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Paste JSON</h3>
                                <p className="text-[11px] text-slate-400">Paste raw JSON and import</p>
                            </div>
                            <button
                                onClick={() => setIsPasteOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <textarea
                                value={pasteText}
                                onChange={(e) => setPasteText(e.target.value)}
                                className="w-full min-h-[220px] input-field font-mono text-[12px]"
                                placeholder='{"example": true}'
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setIsPasteOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePasteImport}
                                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                                >
                                    Import
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
