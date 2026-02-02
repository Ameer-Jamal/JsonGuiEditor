import React, { useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload } from 'lucide-react';
import { useEditor } from '../context/EditorContext';
import { useToast } from './ToastProvider';

export const ExcelImporter = () => {
    const { setFromJson } = useEditor();
    const { addToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
            setFromJson(data);
            addToast('Excel import complete', 'success');
        } catch (error) {
            console.error('Failed to import Excel file:', error);
            addToast('Excel import failed', 'error');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="flex flex-col gap-1">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx, .xls"
                className="hidden"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded shadow-sm transition-colors"
            >
                <Upload className="w-3.5 h-3.5" />
                Import Excel
            </button>
        </div>
    );
};
