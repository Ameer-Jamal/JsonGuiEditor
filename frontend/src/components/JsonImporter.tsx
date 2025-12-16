import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useEditor } from '../context/EditorContext';
import { type BaseNode, type FormNode, type NodeType, type TabNode } from '../types';

const ALLOWED_NODE_TYPES: NodeType[] = ['FORM', 'TAB', 'SECTION', 'FIELD', 'SUBFORM'];

type ImportStatus =
    | { type: 'idle' }
    | { type: 'error'; message: string }
    | { type: 'success'; formName: string };

const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const normalizeNode = (node: unknown, fallbackName: string): BaseNode => {
    if (!isObject(node)) {
        throw new Error('Node entries must be objects.');
    }

    const nodeRecord = node as Record<string, unknown>;
    const resolvedType: NodeType =
        typeof nodeRecord.type === 'string' && ALLOWED_NODE_TYPES.includes(nodeRecord.type as NodeType)
            ? nodeRecord.type as NodeType
            : 'FIELD';

    const baseNode: BaseNode = {
        ...nodeRecord,
        name: typeof nodeRecord.name === 'string' && nodeRecord.name.trim().length > 0
            ? nodeRecord.name
            : fallbackName,
        type: resolvedType,
        width: typeof nodeRecord.width === 'number' ? nodeRecord.width : undefined,
        offset: typeof nodeRecord.offset === 'number' ? nodeRecord.offset : undefined,
    };

    if (nodeRecord.contents && isObject(nodeRecord.contents) && Array.isArray(nodeRecord.contents.rows)) {
        const rows = nodeRecord.contents.rows as Array<Record<string, unknown>>;
        baseNode.contents = {
            ...nodeRecord.contents,
            rows: rows.map((row, rowIndex) => {
                if (!isObject(row) || !Array.isArray(row.contents)) {
                    throw new Error(`Row ${rowIndex + 1} is missing a contents array.`);
                }
                const rowRecord = row as Record<string, unknown> & { contents: unknown[] };
                return {
                    ...rowRecord,
                    contents: rowRecord.contents.map((child, childIndex) =>
                        normalizeNode(child, `Unnamed Node ${rowIndex + 1}.${childIndex + 1}`)
                    )
                };
            })
        };
    }

    return baseNode;
};

const parseForm = (raw: unknown): FormNode => {
    if (!isObject(raw)) {
        throw new Error('File does not contain a JSON object.');
    }
    if (raw.type !== 'FORM') {
        throw new Error('Root object must have type "FORM".');
    }

    const rawRecord = raw as Record<string, unknown>;
    const form: FormNode = {
        ...(raw as FormNode),
        name: typeof rawRecord.name === 'string' && rawRecord.name.trim().length > 0
            ? rawRecord.name
            : 'IMPORTED_FORM',
        type: 'FORM',
    };

    const tabs = Array.isArray(form.tabs) ? form.tabs : [];
    form.tabs = tabs.map(
        (tab, index) => normalizeNode(tab, `Imported Tab ${index + 1}`) as TabNode
    );

    return form;
};

export const JsonImporter = () => {
    const { setData } = useEditor();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<ImportStatus>({ type: 'idle' });

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error('Unable to read file contents.');
                }

                const parsed = JSON.parse(text);
                const form = parseForm(parsed);
                setData(form);
                setStatus({ type: 'success', formName: form.name });
            } catch (err) {
                console.error('Failed to import JSON layout:', err);
                setStatus({
                    type: 'error',
                    message: err instanceof Error ? err.message : 'Unknown error while reading JSON file.'
                });
            }
        };
        reader.onerror = () => {
            setStatus({ type: 'error', message: 'Failed to read the selected file.' });
        };
        reader.readAsText(file);
        event.target.value = '';
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
            <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-sm transition-colors"
            >
                <Upload className="w-3.5 h-3.5" />
                Import JSON
            </button>
            {status.type === 'error' && (
                <span className="text-[11px] text-red-600">
                    {status.message}
                </span>
            )}
            {status.type === 'success' && (
                <span className="text-[11px] text-emerald-600">
                    Imported {status.formName}
                </span>
            )}
        </div>
    );
};
