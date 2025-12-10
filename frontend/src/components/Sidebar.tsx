import React, { useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { type BaseNode, type FormNode, hasRows } from '../types';
import { ChevronRight, Folder, FileText, Layers, Hash, Layout } from 'lucide-react';
import { clsx } from 'clsx';
import { ExcelImporter } from './ExcelImporter';
import { ContextMenu } from './ContextMenu';

import {
    DndContext,
    pointerWithin,
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
    } = useSortable({ id: node.id || 'unknown-id', disabled: level === 0 });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Helper to get children for SortableContext ID list
    const getAllChildrenIds = (n: BaseNode): string[] => {
        if (n.type === 'FORM') return (n as FormNode).tabs?.map(t => t.id!) || [];
        if (hasRows(n)) return n.contents?.rows?.flatMap(r => r.contents.map(c => c.id!)) || [];
        return [];
    };

    const allChildIds = getAllChildrenIds(node);
    const hasChildren = allChildIds.length > 0;
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
                    <div style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                </div>

                <NodeIcon type={node.type} />
                <span className="truncate ml-1.5">{node.name || <span className="italic opacity-40 font-normal">Unnamed</span>}</span>
            </div>

            {hasChildren && isExpanded && (
                <div className="overflow-hidden">
                    <div className="flex flex-col relative">
                        {/* Vertical Guide Line */}
                        <div
                            className="absolute left-0 top-0 bottom-0 w-px bg-slate-200"
                            style={{ left: `${level * 12 + 19}px` }}
                        />

                        <SortableContext
                            items={allChildIds}
                            strategy={verticalListSortingStrategy}
                        >
                            {/* Special rendering for Sections to show Rows */}
                            {node.type === 'SECTION' && node.contents?.rows ? (
                                <div className="flex flex-col gap-1 mt-1">
                                    {node.contents.rows.map((row, rIndex) => (
                                        <div
                                            key={rIndex}
                                            className={clsx(
                                                "relative",
                                                // If multiple items, show visual group. Even for 1 item, showing 'row' grouping helps consistency if desired, 
                                                // but let's stick to user request: "clear that a field is in a different row or same row"
                                            )}
                                        >
                                            {/* Visual Row Container */}
                                            <div className={clsx(
                                                "flex flex-col",
                                                row.contents.length > 1
                                                    ? "bg-slate-50 border border-slate-200 rounded-md mx-2 py-1 mb-1 shadow-sm"
                                                    : ""
                                            )}>
                                                {row.contents.length > 1 && (
                                                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider px-2 mb-0.5">Row Group</div>
                                                )}
                                                {row.contents.map((child, i) => (
                                                    <SortableTreeItem
                                                        key={child.id || `${child.type}-${i}`}
                                                        node={child}
                                                        level={level + 1}
                                                        onContextMenu={onContextMenu}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                // Default rendering for Forms and other Containers (Tabs)
                                node.type === 'FORM'
                                    ? (node as FormNode).tabs?.map((child, i) => (
                                        <SortableTreeItem key={child.id || `${child.type}-${i}`} node={child} level={level + 1} onContextMenu={onContextMenu} />
                                    ))
                                    : (node.contents?.rows?.flatMap(r => r.contents)?.map((child, i) => (
                                        <SortableTreeItem key={child.id || `${child.type}-${i}`} node={child} level={level + 1} onContextMenu={onContextMenu} />
                                    )))
                            )}
                        </SortableContext>
                    </div>
                </div>
            )}
        </div>
    );
};

export const Sidebar = () => {
    const { data, addNode, deleteNode, moveNode, mergeFieldWithPrevious, splitFieldToNewRow } = useEditor();
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

    const handleMerge = () => {
        if (contextMenu) {
            mergeFieldWithPrevious(contextMenu.node.id!);
            setContextMenu(null);
        }
    };

    const handleSplit = () => {
        if (contextMenu) {
            splitFieldToNewRow(contextMenu.node.id!);
            setContextMenu(null);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-2 mb-2 border-b border-slate-100 bg-slate-50/50">
                <ExcelImporter />
                {/* Redundant buttons removed to clean UI, sticking to App.tsx header */}
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar p-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={pointerWithin}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={data.type === 'FORM' ? (data as any).tabs?.map((t: any) => t.id) || [] : []}
                        strategy={verticalListSortingStrategy}
                    >
                        <SortableTreeItem
                            node={data}
                            onContextMenu={handleContextMenu}
                            level={0}
                        />
                    </SortableContext>
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
                    onMergeWithPrevious={handleMerge}
                    onSplitToOwnRow={handleSplit}
                />
            )}
        </div>
    );
};
