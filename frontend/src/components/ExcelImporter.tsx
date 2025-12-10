import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useEditor } from '../context/EditorContext';
import { type FormNode, type TabNode, type SectionNode, type FieldNode, type RowNode } from '../types';
import { Upload, X, ArrowRight } from 'lucide-react';


interface ExcelRow {
    [key: string]: any;
}

type FieldMapping = {
    tabName: string;
    sectionName: string;
    name: string; // The field design name
    type?: string;
    width?: string;
    offset?: string;
    // We can add more if needed
}

export const ExcelImporter = () => {
    const { setData } = useEditor();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [headers, setHeaders] = useState<string[]>([]);
    const [excelData, setExcelData] = useState<ExcelRow[]>([]);

    // Default mapping keys based on user description
    const [mapping, setMapping] = useState<FieldMapping>({
        tabName: 'Tab Name',
        sectionName: 'Section Name',
        name: 'Field Design Name',
        type: 'Display Type',
        width: 'Width',
        offset: 'Offset'
    });
    const [formName, setFormName] = useState<string>('');

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];

            // Get headers
            const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(ws, { header: 1 });
            if (jsonData.length > 0) {
                const headerRow = jsonData[0] as string[];
                setHeaders(headerRow);

                // Get full data
                const data = XLSX.utils.sheet_to_json<ExcelRow>(ws);
                setExcelData(data);
                setIsModalOpen(true);
            }
        };
        reader.readAsBinaryString(file);

        // Reset input immediately so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleImport = () => {
        const tabsMap = new Map<string, Map<string, ExcelRow[]>>();

        // 1. Group by Tab -> Section
        excelData.forEach(row => {
            // Use the mapped column names to get values
            const rawTab = row[mapping.tabName];
            const rawSection = row[mapping.sectionName];

            const tabName = rawTab ? String(rawTab).trim() : 'Default Tab';
            const sectionName = rawSection ? String(rawSection).trim() : 'Default Section';

            if (!tabsMap.has(tabName)) {
                tabsMap.set(tabName, new Map());
            }
            const sections = tabsMap.get(tabName)!;

            if (!sections.has(sectionName)) {
                sections.set(sectionName, []);
            }
            sections.get(sectionName)!.push(row);
        });

        // 2. Construct Tree
        const newTabs: TabNode[] = [];

        tabsMap.forEach((sections, tabName) => {
            const sectionRows: RowNode[] = [];

            sections.forEach((fields, sectionName) => {
                // One field per row logic
                const fieldRows: RowNode[] = [];

                fields.forEach(field => {
                    // Use mapped columns
                    const name = field[mapping.name];
                    // Skip if name is empty
                    if (!name) return;

                    // If width column exists and has value, use it, else default to 3
                    const width = (mapping.width && field[mapping.width]) ? Number(field[mapping.width]) : 3;
                    const offset = (mapping.offset && field[mapping.offset]) ? Number(field[mapping.offset]) : 0;

                    // Map type if provided, default to FIELD
                    const fieldType = (mapping.type && field[mapping.type]) ? field[mapping.type] : 'FIELD';

                    const fieldNode: FieldNode = {
                        name: name,
                        type: fieldType,
                        width: width,
                        offset: offset
                    };

                    // Create a row for THIS SINGLE FIELD
                    fieldRows.push({ contents: [fieldNode] });
                });

                const sectionNode: SectionNode = {
                    name: sectionName,
                    type: 'SECTION',
                    width: 12,
                    offset: 0,
                    contents: {
                        width: 12,
                        cellWidth: 1,
                        rows: fieldRows
                    }
                };

                sectionRows.push({ contents: [sectionNode] });
            });

            const tabNode: TabNode = {
                name: tabName,
                type: 'TAB',
                width: 12,
                offset: 0,
                contents: {
                    width: 12,
                    cellWidth: 1,
                    rows: sectionRows
                }
            };

            newTabs.push(tabNode);
        });

        const newForm: FormNode = {
            name: formName || 'IMPORTED_FORM',
            type: 'FORM',
            tabs: newTabs
        };

        setData(newForm);
        setIsModalOpen(false);
    };

    // Calculate preview stats to warn user of potential mapping issues
    const previewStats = React.useMemo(() => {
        if (!excelData.length || !mapping.tabName || !mapping.name) return null;

        const tabs = new Set<string>();
        const sections = new Set<string>(); // "Tab::Section" unique keys
        let fieldCount = 0;

        excelData.forEach(row => {
            const rawTab = row[mapping.tabName];
            const rawSection = row[mapping.sectionName];

            // Name is required for a valid field
            if (!row[mapping.name]) return;

            const tabName = rawTab ? String(rawTab).trim() : 'Default Tab';
            const sectionName = rawSection ? String(rawSection).trim() : 'Default Section';

            tabs.add(tabName);
            sections.add(`${tabName}::${sectionName}`);
            fieldCount++;
        });

        return {
            tabs: tabs.size,
            sections: sections.size,
            fields: fieldCount
        };
    }, [excelData, mapping]);

    return (
        <div>
            {/* ... (Hidden input and Upload button remain same) ... */}
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

            {/* Import Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-[600px] max-w-full overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-lg font-semibold text-slate-800">Map Excel Columns</h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            <p className="text-sm text-slate-500">
                                Select which columns from your Excel file correspond to the required properties.
                            </p>

                            <div className="space-y-4">
                                <MappingSelect
                                    label="Tab Name"
                                    description="Groups fields into tabs"
                                    value={mapping.tabName}
                                    options={headers}
                                    onChange={(val) => setMapping(prev => ({ ...prev, tabName: val }))}
                                />
                                <MappingSelect
                                    label="Section Name"
                                    description="Groups fields into sections"
                                    value={mapping.sectionName}
                                    options={headers}
                                    onChange={(val) => setMapping(prev => ({ ...prev, sectionName: val }))}
                                />
                                <div className="h-px bg-slate-100 my-4" />
                                <MappingSelect
                                    label="Field Name"
                                    description="Used as the node name (Field Design Name)"
                                    value={mapping.name}
                                    options={headers}
                                    onChange={(val) => setMapping(prev => ({ ...prev, name: val }))}
                                />
                                <MappingSelect
                                    label="Width"
                                    description="Grid width (1-12). Defaults to 3 if empty."
                                    value={mapping.width}
                                    options={headers}
                                    onChange={(val) => setMapping(prev => ({ ...prev, width: val }))}
                                />
                                <MappingSelect
                                    label="Offset"
                                    description="Grid offset. Defaults to 0."
                                    value={mapping.offset}
                                    options={headers}
                                    onChange={(val) => setMapping(prev => ({ ...prev, offset: val }))}
                                />
                                <div className="h-px bg-slate-100 my-4" />
                                <MappingSelect
                                    label="Type"
                                    description="Node Type (e.g., FIELD, SUBFORM). Default: FIELD"
                                    value={mapping.type}
                                    options={headers}
                                    onChange={(val) => setMapping(prev => ({ ...prev, type: val }))}
                                />
                            </div>
                        </div>

                        {/* Form Name Input */}
                        <div className="px-6 py-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Form Name</label>
                            <input
                                type="text"
                                placeholder="Enter form name"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-500">
                                {previewStats ? (
                                    <span className={previewStats.sections > previewStats.fields / 2 ? "text-orange-600 font-medium" : "text-slate-600"}
                                    >
                                        Preview: {previewStats.tabs} Tabs, {previewStats.sections} Sections, {previewStats.fields} Fields
                                    </span>
                                ) : (
                                    <span>Configure mapping to see preview</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={!mapping.tabName || !mapping.name}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Import Layout
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MappingSelect = ({
    label,
    description,
    value,
    options,
    onChange
}: {
    label: string,
    description?: string,
    value: string | undefined,
    options: string[],
    onChange: (val: string) => void
}) => {
    return (
        <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-4">
                <label className="block text-sm font-medium text-slate-700">{label}</label>
                {description && <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>}
            </div>
            <div className="col-span-8">
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                    <option value="">-- Select Column --</option>
                    {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};
