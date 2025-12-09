import React, { useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { type BaseNode, type FormNode, hasRows } from '../types';
import { ChevronRight, Folder, FileText, Layers, Hash, Layout, Copy } from 'lucide-react';
import { clsx } from 'clsx';
import { ExcelImporter } from './ExcelImporter';
import { ContextMenu } from './ContextMenu';
import { motion, AnimatePresence } from 'framer-motion';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const NodeIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'FORM': return <Layout className="w-4 h-4 text-blue-500" />;
        case 'TAB': return <Folder className="w-4 h-4 text-yellow-500" />;
        case 'SECTION': return <Layers className="w-4 h-4 text-purple-500" />;
        case 'FIELD': return <FileText className="w-4 h-4 text-slate-400" />;
        case 'SUBFORM': return <Layers className="w-4 h-4 text-indigo-400" />;
        default: return <Hash className="w-4 h-4 text-slate-300" />;
    }
};

const SortableTreeItem = ({ node, level = 0, onContextMenu }: { node: BaseNode, level?: number, onContextMenu: (e: React.MouseEvent, node: BaseNode) => void }) => {
    const { selectedNode, selectNode } = useEditor();
    const [isExpanded, setIsExpanded] = useState(true);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: node.id || 'unknown-id', disabled: level === 0 }); // Disable dragging for root

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Helper to get children based on node type
    const getChildren = (n: BaseNode): BaseNode[] => {
        if (n.type === 'FORM') {
            return (n as FormNode).tabs || [];
        }
        if (hasRows(n)) {
            const rows = n.contents?.rows || [];
            return rows.flatMap(row => row.contents);
        }
        return [];
    };

    const children = getChildren(node);
    const hasChildren = children.length > 0;
    const isSelected = selectedNode === node || (node.id && selectedNode?.id === node.id);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        selectNode(node);
    };

    return (
        <div ref={setNodeRef} style={style} className="select-none text-[13px] font-medium text-slate-600">
            <div
                className={clsx(
                    "flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer transition-all group relative",
                    isSelected ? "text-blue-600" : "hover:text-slate-900"
                )}
                style={{ paddingLeft: `${level * 12 + 12}px` }}
                onClick={handleSelect}
                onContextMenu={(e) => onContextMenu(e, node)}
                {...attributes}
                {...listeners}
            >
                {/* Active Indicator Background */}
                {isSelected && (
                    <div className="absolute inset-0 bg-blue-50 rounded-md -z-10" />
                )}

                {/* Left Active Line */}
                {isSelected && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-blue-600 rounded-r-full" />
                )}

                <div
                    className={clsx(
                        "p-0.5 rounded transition-colors mr-1",
                        !hasChildren && "opacity-0 invisible",
                        "hover:bg-slate-200/50 text-slate-400"
                    )}
                    onClick={hasChildren ? handleToggle : undefined}
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking toggle
                >
                    <motion.div
                        initial={false}
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </motion.div>
                </div>

                <NodeIcon type={node.type} />
                <span className="truncate ml-1.5">{node.name || <span className="italic opacity-40 font-normal">Unnamed</span>}</span>
            </div>

            <AnimatePresence initial={false}>
                {hasChildren && isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="flex flex-col relative">
                            {/* Vertical Guide Line */}
                            <div
                                className="absolute left-0 top-0 bottom-0 w-px bg-slate-200"
                                style={{ left: `${level * 12 + 19}px` }}
                            />

                            <SortableContext
                                items={children.map(c => c.id || 'unknown')}
                                strategy={verticalListSortingStrategy}
                            >
                                {children.map((child, i) => (
                                    <SortableTreeItem key={child.id || `${child.type}-${i}`} node={child} level={level + 1} onContextMenu={onContextMenu} />
                                ))}
                            </SortableContext>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const Sidebar = () => {
    const { data, addNode, deleteNode, moveNode } = useEditor();
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: BaseNode } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            moveNode(active.id as string, over.id as string);
        }
    };

    const handleExport = () => {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.name || 'form_layout'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopy = () => {
        const jsonString = JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(jsonString);
        alert('JSON copied to clipboard!');
    };


    const handleContextMenu = (e: React.MouseEvent, node: BaseNode) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, node });
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    const handleAddStart = (type: string) => {
        if (contextMenu) {
            addNode(contextMenu.node, type);
            setContextMenu(null);
        }
    };

    const handleDeleteStart = () => {
        if (contextMenu) {
            if (confirm(`Are you sure you want to delete ${contextMenu.node.name}?`)) {
                deleteNode(contextMenu.node);
            }
            setContextMenu(null);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-2 mb-2 border-b border-slate-100 bg-slate-50/50">
                <ExcelImporter />
                <div className="flex gap-1">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded shadow-sm transition-colors"
                        title="Copy JSON to Clipboard"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline">Copy</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded shadow-sm transition-colors"
                        title="Export to JSON File"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline">Export</span>
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-auto pb-10">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableTreeItem node={data} onContextMenu={handleContextMenu} />
                </DndContext>
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    node={contextMenu.node}
                    onClose={handleCloseContextMenu}
                    onAdd={handleAddStart}
                    onDelete={handleDeleteStart}
                />
            )}
        </div>
    );
};
