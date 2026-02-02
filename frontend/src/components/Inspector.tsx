import React, { useEffect, useMemo, useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { jsonTreeToValue } from '../schema';
import { Copy, Check } from 'lucide-react';
import { type SchemaType } from '../types';

const TYPE_OPTIONS: SchemaType[] = ['string', 'number', 'boolean', 'object', 'array', 'null', 'any'];

export const Inspector = () => {
    const {
        selectedNode,
        selectedSchemaNode,
        selectedParent,
        updateNodeValue,
        updateNodeKey,
        updateNodeType,
        updateArrayItemType,
        updateEnumValues,
        updateNodeFromJson,
        getRawJson,
        setFromJson
    } = useEditor();
    const [copied, setCopied] = useState(false);
    const [rawJson, setRawJson] = useState('');
    const [rawError, setRawError] = useState<string | null>(null);
    const [debugJson, setDebugJson] = useState('');
    const [debugError, setDebugError] = useState<string | null>(null);

    const canRename = selectedParent?.type === 'object';
    useEffect(() => {
        setRawJson(getRawJson());
        setRawError(null);
    }, [getRawJson]);

    useEffect(() => {
        if (!selectedNode) return;
        setDebugJson(JSON.stringify(jsonTreeToValue(selectedNode), null, 2));
        setDebugError(null);
    }, [selectedNode]);

    const handleCopyDebug = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedNode) return;
        navigator.clipboard.writeText(debugJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRawApply = () => {
        try {
            const parsed = JSON.parse(rawJson);
            setFromJson(parsed);
            setRawError(null);
        } catch (error) {
            setRawError(error instanceof Error ? error.message : 'Invalid JSON');
        }
    };

    const handleDebugApply = () => {
        if (!selectedNode) return;
        try {
            const parsed = JSON.parse(debugJson);
            updateNodeFromJson(selectedNode.id, parsed);
            setDebugError(null);
        } catch (error) {
            setDebugError(error instanceof Error ? error.message : 'Invalid JSON');
        }
    };

    const enumText = useMemo(() => {
        if (!selectedSchemaNode?.enum) return '';
        return selectedSchemaNode.enum.map(String).join(', ');
    }, [selectedSchemaNode]);

    if (!selectedNode) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl opacity-20">⚙️</span>
                </div>
                <p className="text-sm">Select a node to edit</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Type</h3>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedNode.type}
                        onChange={(e) => updateNodeType(selectedNode.id, e.target.value as SchemaType)}
                        className="input-field text-xs"
                    >
                        {TYPE_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                    {selectedNode.type === 'array' && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span>Items</span>
                            <select
                                value={selectedSchemaNode?.items?.type ?? 'any'}
                                onChange={(e) => updateArrayItemType(selectedNode.id, e.target.value as SchemaType)}
                                className="input-field text-xs"
                            >
                                {TYPE_OPTIONS.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {canRename && (
                <div>
                    <label htmlFor="node-key" className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">Key</label>
                    <input
                        id="node-key"
                        type="text"
                        value={selectedNode.key || ''}
                        onChange={(e) => updateNodeKey(selectedNode.id, e.target.value)}
                        className="input-field w-full"
                        placeholder="Property key"
                    />
                </div>
            )}

            {selectedNode.type === 'string' && (
                <div>
                    <label htmlFor="node-string-value" className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">Value</label>
                    {selectedSchemaNode?.enum ? (
                        <select
                            id="node-string-value"
                            value={String(selectedNode.value ?? '')}
                            onChange={(e) => updateNodeValue(selectedNode.id, e.target.value)}
                            className="input-field w-full"
                        >
                            {selectedSchemaNode.enum.map(option => (
                                <option key={String(option)} value={String(option)}>{String(option)}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            id="node-string-value"
                            type="text"
                            value={String(selectedNode.value ?? '')}
                            onChange={(e) => updateNodeValue(selectedNode.id, e.target.value)}
                            className="input-field w-full"
                        />
                    )}
                </div>
            )}

            {selectedNode.type === 'number' && (
                <div>
                    <label htmlFor="node-number-value" className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">Value</label>
                    <input
                        id="node-number-value"
                        type="number"
                        value={Number(selectedNode.value ?? 0)}
                        onChange={(e) => updateNodeValue(selectedNode.id, e.target.value)}
                        className="input-field w-full"
                    />
                </div>
            )}

            {selectedNode.type === 'boolean' && (
                <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                        type="checkbox"
                        checked={Boolean(selectedNode.value)}
                        onChange={(e) => updateNodeValue(selectedNode.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>Boolean value</span>
                </label>
            )}

            {(selectedNode.type === 'object' || selectedNode.type === 'array') && (
                <div className="text-xs text-slate-500">
                    {selectedNode.type === 'object'
                        ? `Properties: ${selectedNode.children?.length ?? 0}`
                        : `Items: ${selectedNode.children?.length ?? 0}`}
                </div>
            )}

            {selectedNode.type === 'string' && (
                <div>
                    <label htmlFor="node-enum-options" className="block text-xs font-medium text-slate-700 mb-1.5 ml-1">Enum Options</label>
                    <input
                        id="node-enum-options"
                        type="text"
                        value={enumText}
                        onChange={(e) => updateEnumValues(selectedNode.id, e.target.value.split(',').map(item => item.trim()).filter(Boolean))}
                        className="input-field w-full"
                        placeholder="comma,separated,values"
                    />
                </div>
            )}

            <div className="pt-6 border-t border-slate-100">
                <details className="group" open>
                    <summary className="flex items-center justify-between cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors list-none select-none">
                        <div className="flex items-center">
                            <span className="mr-2 transform group-open:rotate-90 transition-transform">▶</span>
                            <span>Debug JSON</span>
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
                        <textarea
                            value={debugJson}
                            onChange={(e) => setDebugJson(e.target.value)}
                            className="w-full min-h-[140px] text-[10px] text-slate-200 font-mono bg-transparent outline-none resize-none"
                        />
                        {debugError && <div className="text-[11px] text-red-400 mt-2">{debugError}</div>}
                        <button
                            onClick={handleDebugApply}
                            className="mt-2 px-2 py-1 text-[10px] font-medium text-slate-200 bg-slate-700 rounded hover:bg-slate-600"
                        >
                            Apply Debug JSON
                        </button>
                    </div>
                </details>
            </div>


            <div className="pt-6 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Raw JSON</h3>
                <textarea
                    value={rawJson}
                    onChange={(e) => setRawJson(e.target.value)}
                    className="input-field w-full min-h-[160px] font-mono text-[11px]"
                />
                {rawError && <div className="text-[11px] text-red-600 mt-1">{rawError}</div>}
                <button
                    onClick={handleRawApply}
                    className="mt-2 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                >
                    Apply JSON
                </button>
            </div>
        </div>
    );
};
