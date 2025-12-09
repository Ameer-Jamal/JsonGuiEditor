import { useEffect, useRef } from 'react';
import { type BaseNode } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface ContextMenuProps {
    x: number;
    y: number;
    node: BaseNode;
    onClose: () => void;
    onAdd: (type: string) => void;
    onDelete: () => void;
}

export const ContextMenu = ({ x, y, node, onClose, onAdd, onDelete }: ContextMenuProps) => {
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
        'SECTION': ['FIELD', 'SECTION', 'SUBFORM'], // Section can have section? Maybe not in strict model but let's allow flexibility or restrict per user spec.
        'SUBFORM': ['FIELD']
    };

    // User spec: Form -> Tab -> Section -> Field.
    // We'll stick to that strictly?
    // Form has Tabs. Tabs have Sections. Sections have Fields (or nested sections?). 
    // The provided JSON shows Section -> Contents -> Rows -> [Field, Field...]
    // But also Section -> Contents -> Rows -> [Section...]
    if (node.type === 'SECTION') {
        allowableChildren['SECTION'] = ['FIELD', 'SECTION'];
    }

    const options = allowableChildren[node.type] || [];

    return (
        <div
            ref={ref}
            className="fixed z-50 bg-white border border-slate-200 shadow-lg rounded-md py-1 w-40"
            style={{ top: y, left: x }}
        >
            <div className="px-3 py-1 text-xs font-semibold text-slate-400 border-b border-slate-100 mb-1">
                {node.name || node.type}
            </div>

            {options.map(type => (
                <button
                    key={type}
                    onClick={() => onAdd(type)}
                    className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                    <Plus className="w-3.5 h-3.5 text-blue-500" />
                    Add {type}
                </button>
            ))}

            {options.length === 0 && (
                <div className="px-3 py-1.5 text-xs text-slate-400 italic">
                    No items to add
                </div>
            )}

            {node.type !== 'FORM' && (
                <>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                        onClick={onDelete}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                    </button>
                </>
            )}
        </div>
    );
};
