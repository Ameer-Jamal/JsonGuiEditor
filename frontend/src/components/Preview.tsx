import React from 'react';
import { useEditor } from '../context/EditorContext';
import { type BaseNode, type FormNode, hasRows } from '../types';
import { clsx } from 'clsx';
import { GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';

const FieldRenderer = ({ node }: { node: BaseNode }) => {
    // Try to determine input type from name or props
    const label = node.name || "Untitled Field";
    const placeholder = node.placeholder || "Enter value...";
    const isDate = label.toLowerCase().includes('date');
    const isNumber = label.toLowerCase().includes('amount') || label.toLowerCase().includes('qty') || label.toLowerCase().includes('price');
    const isSelect = label.toLowerCase().includes('status') || label.toLowerCase().includes('type');
    const isTextArea = label.toLowerCase().includes('description') || label.toLowerCase().includes('notes') || label.toLowerCase().includes('comment');

    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-medium text-slate-700 ml-1">
                {label} <span className="text-red-400 hidden">*</span>
            </label>
            {isTextArea ? (
                <textarea
                    className="input-field min-h-[80px] w-full resize-none"
                    placeholder={placeholder}
                    readOnly
                />
            ) : isSelect ? (
                <select className="input-field w-full appearance-none bg-white" disabled>
                    <option>Select {label}...</option>
                </select>
            ) : (
                <input
                    type={isDate ? "date" : isNumber ? "number" : "text"}
                    className="input-field w-full"
                    placeholder={placeholder}
                    readOnly
                />
            )}
        </div>
    );
};

const GridCell = ({ node, children }: { node: BaseNode, children?: React.ReactNode }) => {
    const { selectedNode, selectNode } = useEditor();
    const isSelected = selectedNode === node || (node.id && selectedNode?.id === node.id);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={clsx(
                "relative group flex flex-col",
                "transition-all duration-200"
            )}
            style={{ gridColumn: `span ${node.width || 12}` }}
            onClick={(e) => {
                e.stopPropagation();
                selectNode(node);
            }}
        >
            <div className={clsx(
                "flex-1 border rounded-lg overflow-hidden shadow-sm transition-all duration-200 relative bg-white",
                isSelected
                    ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md z-10"
                    : "border-slate-200 hover:border-blue-300 hover:shadow-md"
            )}>
                {/* Drag Handle Overlay (Visible on Hover) */}
                <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                </div>

                {/* Content */}
                <div className="p-3">
                    {children ? children : (
                        node.type === 'FIELD' ? (
                            <FieldRenderer node={node} />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 opacity-40">
                                <span className={clsx("text-xs font-medium uppercase tracking-wider", isSelected ? "text-blue-500" : "text-slate-400")}>
                                    {node.type}: {node.name}
                                </span>
                            </div>
                        )
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const FormRenderer = ({ node }: { node: BaseNode }) => {
    if (node.type === 'FORM') {
        const formNode = node as FormNode;
        // Modern Tab View
        return (
            <div className="w-full space-y-8">
                <div className="text-center pb-6 border-b border-slate-100">
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">{node.name || "Untitled Form"}</h1>
                    <p className="text-sm text-slate-400 mt-1">Form Layout Preview</p>
                </div>

                <div className="space-y-12">
                    {formNode.tabs && formNode.tabs.map((tab, i) => (
                        <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-200/60 shadow-inner">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">{i + 1}</span>
                                <h3 className="text-lg font-semibold text-slate-700 uppercase tracking-wide">{tab.name}</h3>
                            </div>
                            <ContentRenderer node={tab} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return <GridCell node={node} />;
};

const ContentRenderer = ({ node }: { node: BaseNode }) => {
    if (!hasRows(node)) {
        return <GridCell node={node} />;
    }

    const rows = node.contents?.rows || [];

    return (
        <div className="grid grid-cols-12 gap-6 auto-rows-max">
            {rows.map((row, rIndex) => (
                <React.Fragment key={rIndex}>
                    {row.contents.map((child, cIndex) => (
                        child.type === 'SECTION' || child.type === 'SUBFORM' ? (
                            <div key={`${rIndex}-${cIndex}`}
                                className="space-y-3"
                                style={{ gridColumn: `span ${child.width || 12}` }}
                            >
                                <motion.div
                                    className="p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-blue-200 transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // TODO: Select section logic if needed, currently clicks through
                                    }}
                                >
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 pl-1">{child.name}</h4>
                                    <ContentRenderer node={child} />
                                </motion.div>
                            </div>
                        ) : (
                            <GridCell key={`${rIndex}-${cIndex}`} node={child} />
                        )
                    ))}
                </React.Fragment>
            ))}
        </div>
    );
};


export const Preview = () => {
    const { data } = useEditor();

    return (
        <div className="w-full">
            <FormRenderer node={data} />
        </div>
    );
};
