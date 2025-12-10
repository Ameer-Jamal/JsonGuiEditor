import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { type BaseNode } from '../types';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface ContextMenuProps {
    x: number;
    y: number;
    node: BaseNode;
    onClose: () => void;
    onAdd: (type: string) => void;
    onDelete: () => void;
    onMergeWithPrevious: () => void;
    onSplitToOwnRow: () => void;
}

export const ContextMenu = ({ x, y, node, onClose, onAdd, onDelete, onMergeWithPrevious, onSplitToOwnRow }: ContextMenuProps) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const allowableChildren: Record<string, string[]> = {
        'FORM': ['TAB'],
        'TAB': ['SECTION'],
        'SECTION': ['FIELD', 'SECTION', 'SUBFORM'],
        'SUBFORM': ['FIELD']
    };

    if (node.type === 'SECTION') {
        allowableChildren['SECTION'] = ['FIELD', 'SECTION'];
    }

    const options = allowableChildren[node.type] || [];

    // Treat anything that isn't a container as a Field (legacy support for Imported types)
    const isFieldLike = !['FORM', 'TAB', 'SECTION', 'SUBFORM'].includes(node.type);

    return createPortal(
        <div
            ref={ref}
            className="fixed z-[9999] bg-white border border-slate-200 shadow-xl rounded-md py-1 w-56 flex flex-col"
            style={{ top: y, left: x }}
        >
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 border-b border-slate-100 mb-1 truncate max-w-full bg-slate-50/50" title={node.name || node.type}>
                {node.name || node.type}
            </div>

            {options.map(type => (
                <button
                    key={type}
                    onClick={() => onAdd(type)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    Add {type}
                </button>
            ))}

            {isFieldLike && (
                <>
                    {options.length > 0 && <div className="h-px bg-slate-100 my-1" />}
                    <button
                        onClick={onMergeWithPrevious}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                        <ArrowUp className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        Merge with Row Above
                    </button>
                    <button
                        onClick={onSplitToOwnRow}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                        <ArrowDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        Move to Own Row
                    </button>
                </>
            )}

            {node.type !== 'FORM' && (
                <>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                        onClick={onDelete}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        Delete
                    </button>
                </>
            )}
        </div>,
        document.body
    );
};
