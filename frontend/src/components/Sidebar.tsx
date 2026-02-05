import React, { useMemo, useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { type JsonNode, type PathSegment } from '../types';
import { ChevronRight, Box, List, Type, ToggleLeft, Hash } from 'lucide-react';
import { clsx } from 'clsx';
import { ExcelImporter } from './ExcelImporter';
import { JsonImporter } from './JsonImporter';
import { ContextMenu } from './ContextMenu';
import { ProfileManager } from './ProfileManager';
import { buildMappedTree, type MappedNode } from '../profileMapping';
import { findJsonNodeByPath, jsonTreeToValue } from '../schema';

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
        case 'object': return <Box className="w-4 h-4 text-blue-500" />;
        case 'array': return <List className="w-4 h-4 text-purple-500" />;
        case 'string': return <Type className="w-4 h-4 text-slate-500" />;
        case 'boolean': return <ToggleLeft className="w-4 h-4 text-emerald-500" />;
        case 'number': return <Hash className="w-4 h-4 text-amber-500" />;
        default: return <Hash className="w-4 h-4 text-slate-300" />;
    }
};

const getNodeLabel = (node: JsonNode, index: number | null, parentType?: string) => {
    if (node.key) return node.key;
    if (parentType === 'array' && index !== null) return `[${index}]`;
    return 'root';
};

const filterMappedTree = (nodes: MappedNode[], term: string): MappedNode[] => {
    const lowered = term.trim().toLowerCase();
    if (!lowered) return nodes;
    return nodes
        .map(node => {
            const titleMatch = node.title.toLowerCase().includes(lowered);
            const children = node.children ? filterMappedTree(node.children, term) : [];
            if (titleMatch) return { ...node, children };
            if (children.length > 0) return { ...node, children };
            return null;
        })
        .filter(Boolean) as MappedNode[];
};

const filterRawTree = (node: JsonNode, term: string): JsonNode | null => {
    const lowered = term.trim().toLowerCase();
    if (!lowered) return node;
    const label = getNodeLabel(node, null).toLowerCase();
    const value = node.value ? String(node.value).toLowerCase() : '';
    const matches = label.includes(lowered) || value.includes(lowered);
    const children = node.children?.map(child => filterRawTree(child, term)).filter(Boolean) as JsonNode[] | undefined;
    if (matches || (children && children.length > 0)) {
        return { ...node, children };
    }
    return null;
};

const SortableTreeItem = ({ node, level = 0, onContextMenu, parentType, index }: { node: JsonNode, level?: number, parentType?: string, index: number | null, onContextMenu: (e: React.MouseEvent, node: JsonNode) => void }) => {
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

    const allChildIds = node.children?.map(child => child.id) ?? [];
    const hasChildren = allChildIds.length > 0;
    const isSelected = selectedNode === node || (node.id && selectedNode?.id === node.id);
    const label = getNodeLabel(node, index, parentType);
    const valuePreview = node.type === 'string' || node.type === 'number' || node.type === 'boolean' || node.type === 'null'
        ? String(node.value ?? '')
        : '';

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const handleSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        selectNode(node);
    };

    return (
        <div ref={setNodeRef} style={style} className="select-none text-[13px] font-medium text-slate-600">
            <div
                className={clsx(
                    "flex items-center gap-1 py-1 px-2 rounded-md transition-all group relative",
                    isSelected ? "text-blue-600" : "hover:text-slate-900"
                )}
                style={{ paddingLeft: `${level * 12 + 12}px` }}
            >
                {/* Active Indicator Background */}
                {isSelected && (
                    <div className="absolute inset-0 bg-blue-50 rounded-md -z-10" />
                )}

                {/* Left Active Line */}
                {isSelected && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-blue-600 rounded-r-full" />
                )}

                <button
                    type="button"
                    className={clsx(
                        "p-0.5 rounded transition-colors mr-1 inline-flex",
                        !hasChildren && "opacity-0 invisible",
                        "hover:bg-slate-200/50 text-slate-400"
                    )}
                    onClick={hasChildren ? handleToggle : undefined}
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking toggle
                >
                    <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                </button>

                <button
                    type="button"
                    className="flex items-center gap-1 flex-1 text-left"
                    onClick={handleSelect}
                    onContextMenu={(e) => onContextMenu(e, node)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelect(e);
                        }
                    }}
                    {...attributes}
                    {...listeners}
                >
                    <NodeIcon type={node.type} />
                    <span className="truncate ml-1.5">{label}</span>
                    <span className="ml-auto text-[10px] text-slate-400 uppercase">{node.type}</span>
                </button>
            </div>

            {hasChildren && isExpanded && (
                <div className="overflow-hidden">
                    <div className="flex flex-col relative">
                        {/* Vertical Guide Line */}
                        <div
                            className="absolute left-0 top-0 bottom-0 w-px bg-slate-200"
                            style={{ left: `${level * 12 + 19}px` }}
                        />

                        <SortableContext items={allChildIds} strategy={verticalListSortingStrategy}>
                            {node.children?.map((child, i) => (
                                <SortableTreeItem
                                    key={child.id || `${child.type}-${i}`}
                                    node={child}
                                    index={i}
                                    parentType={node.type}
                                    level={level + 1}
                                    onContextMenu={onContextMenu}
                                />
                            ))}
                        </SortableContext>
                    </div>
                </div>
            )}

            {!hasChildren && valuePreview && (
                <div className="ml-7 mb-1 text-[10px] text-slate-400 truncate">
                    {valuePreview}
                </div>
            )}
        </div>
    );
};

export const Sidebar = () => {
    const { valueTree, addChildNode, deleteNode, moveNode, layoutMode, activeProfile, selectNode, selectedNode, addProfileNode } = useEditor();
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: JsonNode } | null>(null);
    const [activeTab, setActiveTab] = useState<'tree' | 'profile'>('tree');
    const [treeView, setTreeView] = useState<'profile' | 'raw'>('profile');
    const [searchTerm, setSearchTerm] = useState('');
    const [structureView, setStructureView] = useState(true);
    const [profileMenu, setProfileMenu] = useState<{
        x: number;
        y: number;
        levelIndex: number;
        parentPath: any[];
        label: string;
    } | null>(null);
    const profileTree = useMemo(() => {
        if (!activeProfile) return null;
        return buildMappedTree(activeProfile, jsonTreeToValue(valueTree));
    }, [activeProfile, valueTree]);

    const normalizePathKey = (path: PathSegment[]) =>
        path.map(segment => segment.kind === 'object' ? segment.key : '[*]').join('.');

    const collapseMappedTree = (nodes: MappedNode[], levelIndex: number): MappedNode[] => {
        if (!activeProfile) return nodes;
        const groups = new Map<string, MappedNode[]>();
        nodes.forEach(node => {
            const key = normalizePathKey(node.path);
            const existing = groups.get(key) ?? [];
            existing.push(node);
            groups.set(key, existing);
        });
        return Array.from(groups.values()).map(group => {
            const base = group[0];
            const hasDifferentTitles = group.some(node => node.title !== base.title);
            const mergedTitle = hasDifferentTitles
                ? (activeProfile.levels[levelIndex]?.name ?? base.title)
                : base.title;
            const children = base.children ? collapseMappedTree(base.children, levelIndex + 1) : undefined;
            return { ...base, title: mergedTitle, children };
        });
    };

    const filteredProfileTree = useMemo(() => {
        if (!profileTree) return null;
        const base = structureView ? collapseMappedTree(profileTree, 0) : profileTree;
        return filterMappedTree(base, searchTerm);
    }, [profileTree, searchTerm, structureView]);

    const filteredRawTree = useMemo(() => filterRawTree(valueTree, searchTerm), [searchTerm, valueTree]);

    const handleProfileMenu = (event: React.MouseEvent, levelIndex: number, parentPath: any[]) => {
        event.preventDefault();
        if (!activeProfile) return;
        const targetLevel = activeProfile.levels[levelIndex];
        if (!targetLevel) return;
        setProfileMenu({
            x: event.clientX,
            y: event.clientY,
            levelIndex,
            parentPath,
            label: targetLevel.name ?? 'Item'
        });
    };

    const renderProfileTree = () => {
        const nodes = filteredProfileTree;
        if (!nodes?.length) {
            return (
                <div className="text-xs text-slate-400 p-3">
                    No profile mapping results. Update the profile paths and filters.
                </div>
            );
        }

        return (
            <div className="space-y-2">
                {activeProfile && (
                    <button
                        type="button"
                        onClick={() => addProfileNode(0, [])}
                        className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200"
                    >
                        Add {activeProfile.levels[0]?.name ?? 'Item'}
                    </button>
                )}
                {nodes.map(node => (
                    <ProfileTreeNode
                        key={node.id}
                        node={node}
                        levelIndex={0}
                        selectNode={selectNode}
                        selectedNode={selectedNode}
                        valueTree={valueTree}
                        onContextMenu={handleProfileMenu}
                    />
                ))}
            </div>
        );
    };



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


    const handleContextMenu = (e: React.MouseEvent, node: JsonNode) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, node });
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    const handleAddStart = (type: string) => {
        if (contextMenu) {
            addChildNode(contextMenu.node.id, type as any);
            setContextMenu(null);
        }
    };

    const handleDeleteStart = () => {
        if (contextMenu) {
            const label = contextMenu.node.key || contextMenu.node.type;
            if (confirm(`Are you sure you want to delete ${label}?`)) {
                deleteNode(contextMenu.node.id);
            }
            setContextMenu(null);
        }
    };

    const showProfileTree = treeView === 'profile' && activeProfile && layoutMode === 'profile';
    const hasSearch = searchTerm.trim().length > 0;
    let rawTreeContent: React.ReactNode;
    if (hasSearch) {
        rawTreeContent = filteredRawTree ? (
            <SortableTreeItem
                node={filteredRawTree}
                onContextMenu={handleContextMenu}
                level={0}
                index={null}
            />
        ) : (
            <div className="text-xs text-slate-400 p-3">No matches.</div>
        );
    } else {
        rawTreeContent = (
            <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={valueTree.children?.map(child => child.id) || []}
                    strategy={verticalListSortingStrategy}
                >
                    <SortableTreeItem
                        node={valueTree}
                        onContextMenu={handleContextMenu}
                        level={0}
                        index={null}
                    />
                </SortableContext>
            </DndContext>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <ExcelImporter />
                    <JsonImporter />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('tree')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                            activeTab === 'tree'
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        Tree
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('profile')}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                            activeTab === 'profile'
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        Profiles
                    </button>
                </div>
                {activeTab === 'tree' && (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setTreeView('profile')}
                                className={clsx(
                                    "px-3 py-1 text-[11px] font-medium rounded border transition-colors",
                                    treeView === 'profile'
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                )}
                                disabled={!activeProfile}
                            >
                                Profile Tree
                            </button>
                            <button
                                type="button"
                                onClick={() => setTreeView('raw')}
                                className={clsx(
                                    "px-3 py-1 text-[11px] font-medium rounded border transition-colors",
                                    treeView === 'raw'
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                Raw Tree
                            </button>
                        </div>
                        {treeView === 'profile' && activeProfile && (
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>Structure View</span>
                                <button
                                    type="button"
                                    onClick={() => setStructureView(prev => !prev)}
                                    className={clsx(
                                        "px-2 py-1 text-[11px] font-medium rounded border transition-colors",
                                        structureView
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                >
                                    {structureView ? 'On' : 'Off'}
                                </button>
                            </div>
                        )}
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field text-xs w-full"
                            placeholder="Search..."
                        />
                    </>
                )}
            </div>

            {activeTab === 'profile' && (
                <div className="flex-1 overflow-auto custom-scrollbar p-3">
                    <ProfileManager />
                </div>
            )}

            {activeTab === 'tree' && (
                <div className="flex-1 overflow-auto custom-scrollbar p-2">
                    {showProfileTree ? renderProfileTree() : rawTreeContent}
                </div>
            )}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    node={contextMenu.node}
                    isRoot={contextMenu.node.id === valueTree.id}
                    onClose={handleCloseContextMenu}
                    onAdd={handleAddStart}
                    onDelete={handleDeleteStart}
                />
            )}

            {profileMenu && activeProfile && (
                <ProfileContextMenu
                    x={profileMenu.x}
                    y={profileMenu.y}
                    label={profileMenu.label}
                    onAdd={() => {
                        addProfileNode(profileMenu.levelIndex, profileMenu.parentPath);
                        setProfileMenu(null);
                    }}
                    onClose={() => setProfileMenu(null)}
                />
            )}
        </div>
    );
};

const ProfileTreeNode = ({
    node,
    levelIndex,
    selectNode,
    selectedNode,
    valueTree,
    onContextMenu
}: {
    node: MappedNode;
    levelIndex: number;
    selectNode: (node: JsonNode) => void;
    selectedNode: JsonNode | null;
    valueTree: JsonNode;
    onContextMenu: (event: React.MouseEvent, levelIndex: number, parentPath: any[]) => void;
}) => {
    const [open, setOpen] = useState(true);
    const resolvedNode = findJsonNodeByPath(valueTree, node.path);
    const isSelected = resolvedNode && selectedNode?.id === resolvedNode.id;
    const hasChildren = Boolean(node.children && node.children.length > 0);

    return (
        <div className="space-y-1">
            <button
                type="button"
                onClick={() => {
                    setOpen(prev => !prev);
                    if (resolvedNode) selectNode(resolvedNode);
                }}
                onContextMenu={(event) => onContextMenu(event, levelIndex + 1, node.path)}
                className={clsx(
                    "flex items-center gap-2 text-[11px] font-medium text-slate-600 px-2 py-1 rounded hover:bg-slate-100",
                    isSelected && "bg-blue-50 text-blue-700"
                )}
            >
                {hasChildren && (
                    <ChevronRight className={clsx("w-3 h-3 transition-transform", open && "rotate-90")} />
                )}
                <span className="truncate">{node.title}</span>
            </button>
            {hasChildren && open && (
                <div className="space-y-1 pl-3">
                    {node.children!.map(child => (
                        <ProfileTreeNode
                            key={child.id}
                            node={child}
                            levelIndex={levelIndex + 1}
                            selectNode={selectNode}
                            selectedNode={selectedNode}
                            valueTree={valueTree}
                            onContextMenu={onContextMenu}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const ProfileContextMenu = ({
    x,
    y,
    label,
    onAdd,
    onClose
}: {
    x: number;
    y: number;
    label: string;
    onAdd: () => void;
    onClose: () => void;
}) => (
    <div
        className="fixed z-[9999] bg-white border border-slate-200 shadow-xl rounded-md py-1 w-44"
        style={{ top: y, left: x }}
    >
        <button
            type="button"
            onClick={onAdd}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
            Add {label}
        </button>
        <button
            type="button"
            onClick={onClose}
            className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
            Close
        </button>
    </div>
);
