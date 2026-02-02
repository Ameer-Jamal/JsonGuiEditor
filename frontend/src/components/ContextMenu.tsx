import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type JsonNode, type SchemaType } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface ContextMenuProps {
    x: number;
    y: number;
    node: JsonNode;
    isRoot: boolean;
    onClose: () => void;
    onAdd: (type: SchemaType) => void;
    onDelete: () => void;
}

const CHILD_TYPE_OPTIONS: SchemaType[] = ['string', 'number', 'boolean', 'object', 'array', 'null'];

export const ContextMenu = ({ x, y, node, isRoot, onClose, onAdd, onDelete }: ContextMenuProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{ left: number; top: number }>({ left: x, top: y });

    const clampToViewport = useCallback(() => {
        const menuEl = ref.current;
        if (!menuEl) return;

        const rect = menuEl.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportOffsetX = viewport?.offsetLeft ?? 0;
        const viewportOffsetY = viewport?.offsetTop ?? 0;
        const viewportWidth = viewport?.width ?? window.innerWidth;
        const viewportHeight = viewport?.height ?? window.innerHeight;

        const CURSOR_OFFSET = 6;
        const EDGE_PADDING = 8;

        const desiredLeft = (x - viewportOffsetX) + CURSOR_OFFSET;
        const desiredTop = (y - viewportOffsetY) + CURSOR_OFFSET;

        const maxLeft = Math.max(EDGE_PADDING, viewportWidth - rect.width - EDGE_PADDING);
        const maxTop = Math.max(EDGE_PADDING, viewportHeight - rect.height - EDGE_PADDING);

        const nextLeft = Math.min(Math.max(desiredLeft, EDGE_PADDING), maxLeft);
        const nextTop = Math.min(Math.max(desiredTop, EDGE_PADDING), maxTop);

        setCoords(prev => (prev.left === nextLeft && prev.top === nextTop ? prev : { left: nextLeft, top: nextTop }));
    }, [x, y]);

    useLayoutEffect(() => {
        clampToViewport();
    }, [clampToViewport]);

    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return;

        viewport.addEventListener('scroll', clampToViewport);
        viewport.addEventListener('resize', clampToViewport);
        return () => {
            viewport.removeEventListener('scroll', clampToViewport);
            viewport.removeEventListener('resize', clampToViewport);
        };
    }, [clampToViewport]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const options = node.type === 'object' || node.type === 'array' ? CHILD_TYPE_OPTIONS : [];

    return createPortal(
        <div
            ref={ref}
            className="fixed z-[9999] bg-white border border-slate-200 shadow-xl rounded-md py-1 w-56 flex flex-col"
            style={{ top: coords.top, left: coords.left }}
        >
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 border-b border-slate-100 mb-1 truncate max-w-full bg-slate-50/50" title={node.key || node.type}>
                {node.key || node.type}
            </div>

            {options.map(type => (
                <button
                    key={type}
                    onClick={() => onAdd(type)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    Add {node.type === 'array' ? 'Item' : 'Property'} ({type})
                </button>
            ))}

            {!isRoot && (
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
