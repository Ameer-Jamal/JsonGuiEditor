import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor } from '../context/EditorContext';
import { type JsonNode, type PathSegment } from '../types';
import { ChevronRight, Box, List, Type, ToggleLeft, Hash, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { ExcelImporter } from './ExcelImporter';
import { JsonImporter } from './JsonImporter';
import { ContextMenu } from './ContextMenu';
import { ProfileManager } from './ProfileManager';
import { buildMappedTree, type MappedNode } from '../profileMapping';
import { findJsonNodeByPath, jsonTreeToValue } from '../schema';
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';

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
                {isSelected && (
                    <div className="absolute inset-0 bg-blue-50 rounded-md -z-10" />
                )}

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
                    onPointerDown={(e) => e.stopPropagation()}
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
    const { valueTree, addChildNode, deleteNode, moveNode, layoutMode, activeProfile, selectNode, selectedNode, addProfileNode, updateNodeFromJson } = useEditor();
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: JsonNode } | null>(null);
    const [activeTab, setActiveTab] = useState<'tree' | 'profile'>('tree');
    const [treeView, setTreeView] = useState<'profile' | 'raw'>('profile');
    const [searchTerm, setSearchTerm] = useState('');
    const [structureView, setStructureView] = useState(true);
    type ProfileMenuState = {
        levelIndex: number;
        parentPath: PathSegment[];
        label: string;
        ancestorPaths: PathSegment[][];
        anchorEl: HTMLElement;
    } | null;
    const [profileMenu, setProfileMenu] = useState<ProfileMenuState>(null);
    const [menuCoords, setMenuCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const profileMenuRef = useRef<HTMLDivElement | null>(null);
    const [editModal, setEditModal] = useState<{
        nodeId: string;
        json: string;
        error?: string;
        view?: 'tree' | 'raw';
    } | null>(null);
    const [jsonTreeOpen, setJsonTreeOpen] = useState<Set<string>>(() => new Set(['$']));

    useEffect(() => {
        if (!profileMenu?.anchorEl || !profileMenuRef.current) return;

        const cleanup = autoUpdate(profileMenu.anchorEl, profileMenuRef.current, () => {
            computePosition(profileMenu.anchorEl, profileMenuRef.current!, {
                placement: 'right-start',
                strategy: 'fixed',
                middleware: [offset(6), flip({ padding: 12 }), shift({ padding: 12 })],
            }).then(({ x, y }) => setMenuCoords({ x, y }));
        });

        return () => cleanup();
    }, [profileMenu]);

    useEffect(() => {
        if (!profileMenu) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setProfileMenu(null);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [profileMenu]);

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

    const handleProfileMenu = (event: React.MouseEvent, levelIndex: number, parentPath: PathSegment[], ancestorPaths: PathSegment[][]) => {
        event.preventDefault();
        event.stopPropagation();
        if (!activeProfile) return;
        const targetLevel = activeProfile.levels[levelIndex];
        if (!targetLevel) return;
        setMenuCoords({ x: event.clientX, y: event.clientY });
        setProfileMenu({
            levelIndex,
            parentPath,
            label: targetLevel.name ?? 'Item',
            ancestorPaths,
            anchorEl: event.currentTarget as HTMLElement
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
                        ancestorPaths={[]}
                        selectNode={selectNode}
                        selectedNode={selectedNode}
                        valueTree={valueTree}
                        onMenu={handleProfileMenu}
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

            {profileMenu && activeProfile && createPortal(
                <div
                    className="fixed inset-0 z-[9999]"
                    onClick={() => setProfileMenu(null)}
                    aria-label="Profile menu overlay"
                >
                    <div
                        ref={profileMenuRef}
                        className="absolute bg-white rounded-xl shadow-2xl border border-slate-200 w-56 overflow-hidden text-sm text-slate-700"
                        style={{ top: `${menuCoords.y}px`, left: `${menuCoords.x}px` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Add</div>
                        {activeProfile.levels.map((level, index) => {
                            const canAdd = index === 0 ||
                                index - 1 < profileMenu.ancestorPaths.length ||
                                index - 1 === profileMenu.ancestorPaths.length;
                            return (
                                <button
                                    key={`${level.name}-${index}`}
                                    disabled={!canAdd}
                                    className={clsx(
                                        "w-full text-left px-3 py-2 hover:bg-slate-50",
                                        !canAdd && "text-slate-300 cursor-not-allowed"
                                    )}
                                    onClick={() => {
                                        let parentPath: PathSegment[] | null = null;
                                        if (index === 0) {
                                            parentPath = [];
                                        } else if (index - 1 < profileMenu.ancestorPaths.length) {
                                            parentPath = profileMenu.ancestorPaths[index - 1];
                                        } else if (index - 1 === profileMenu.ancestorPaths.length) {
                                            parentPath = profileMenu.parentPath;
                                        }
                                        if (!parentPath) return;
                                        addProfileNode(index, parentPath);
                                        setProfileMenu(null);
                                    }}
                                >
                                    Add {level.name}
                                </button>
                            );
                        })}
                        <div className="border-t border-slate-100" />
                        <button
                            disabled={!findJsonNodeByPath(valueTree, profileMenu.parentPath)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed"
                            onClick={() => {
                                const resolved = findJsonNodeByPath(valueTree, profileMenu.parentPath);
                                if (!resolved) return;
                                setEditModal({
                                    nodeId: resolved.id,
                                    json: JSON.stringify(jsonTreeToValue(resolved), null, 2),
                                    view: 'tree'
                                });
                                setJsonTreeOpen(new Set(['$']));
                                setProfileMenu(null);
                            }}
                        >
                            Edit JSON
                        </button>
                        <button
                            disabled={!findJsonNodeByPath(valueTree, profileMenu.parentPath)}
                            className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-white disabled:cursor-not-allowed"
                            onClick={() => {
                                const resolved = findJsonNodeByPath(valueTree, profileMenu.parentPath);
                                if (!resolved) return;
                                deleteNode(resolved.id);
                                setProfileMenu(null);
                            }}
                        >
                            Delete
                        </button>
                        <div className="border-t border-slate-100" />
                        <button
                            className="w-full text-left px-3 py-2 hover:bg-slate-50"
                            onClick={() => setProfileMenu(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {editModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-w-[96vw] h-[65vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Edit JSON</h3>
                                <p className="text-[11px] text-slate-400">Applies to the selected profile node</p>
                            </div>
                            <button
                                onClick={() => setEditModal(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 space-y-3 overflow-y-auto flex-1 min-h-0">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditModal(prev => prev ? { ...prev, view: 'tree' } : prev)}
                                    className={clsx(
                                        "px-2 py-1 text-[11px] font-medium rounded border transition-colors",
                                        editModal.view === 'tree'
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                >
                                    Tree
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditModal(prev => prev ? { ...prev, view: 'raw' } : prev)}
                                    className={clsx(
                                        "px-2 py-1 text-[11px] font-medium rounded border transition-colors",
                                        editModal.view === 'raw'
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                >
                                    Raw JSON
                                </button>
                            </div>
                            {editModal.view === 'raw' && (
                                <textarea
                                    value={editModal.json}
                                    onChange={(e) => setEditModal(prev => prev ? { ...prev, json: e.target.value, error: undefined } : prev)}
                                    className="input-field w-full min-h-[300px] font-mono text-[11px]"
                                />
                            )}
                            {editModal.view === 'tree' && (() => {
                                let parsed: any = null;
                                try {
                                    parsed = JSON.parse(editModal.json);
                                } catch {
                                    parsed = null;
                                }

                                const toggle = (key: string) => {
                                    setJsonTreeOpen(prev => {
                                        const next = new Set(prev);
                                        if (next.has(key)) {
                                            next.delete(key);
                                        } else {
                                            next.add(key);
                                        }
                                        return next;
                                    });
                                };

                                const renderValue = (value: any, pathKey: string, depth = 0) => {
                                    const indent = { paddingLeft: `${depth * 14}px` };
                                    if (Array.isArray(value)) {
                                        const open = jsonTreeOpen.has(pathKey);
                                        return (
                                            <div style={indent} className="text-[11px] font-mono text-slate-700">
                                                <button
                                                    type="button"
                                                    onClick={() => toggle(pathKey)}
                                                    className="mr-1 text-slate-400"
                                                >
                                                    <ChevronRight className={clsx("w-3 h-3 inline", open && "rotate-90")} />
                                                </button>
                                                <span className="text-purple-600">Array</span> [{value.length}]
                                                {open && (
                                                    <div className="mt-1 space-y-1">
                                                        {value.map((item, idx) => (
                                                            <div key={`${pathKey}-${idx}`}>
                                                                {renderValue(item, `${pathKey}.${idx}`, depth + 1)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    if (value && typeof value === 'object') {
                                        const open = jsonTreeOpen.has(pathKey);
                                        const entries = Object.entries(value);
                                        return (
                                            <div style={indent} className="text-[11px] font-mono text-slate-700">
                                                <button
                                                    type="button"
                                                    onClick={() => toggle(pathKey)}
                                                    className="mr-1 text-slate-400"
                                                >
                                                    <ChevronRight className={clsx("w-3 h-3 inline", open && "rotate-90")} />
                                                </button>
                                                <span className="text-blue-600">Object</span> {`{${entries.length}}`}
                                                {open && (
                                                    <div className="mt-1 space-y-1">
                                                        {entries.map(([key, val]) => (
                                                            <div key={`${pathKey}.${key}`} className="flex gap-2">
                                                                <span className="text-emerald-700" style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
                                                                    {key}:
                                                                </span>
                                                                <div className="flex-1">
                                                                    {renderValue(val, `${pathKey}.${key}`, depth + 1)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    const type = value === null ? 'null' : typeof value;
                                    const color =
                                        type === 'string' ? 'text-amber-700' :
                                        type === 'number' ? 'text-indigo-700' :
                                        type === 'boolean' ? 'text-rose-700' : 'text-slate-500';
                                    return (
                                        <div style={indent} className={`text-[11px] font-mono ${color}`}>
                                            {type === 'string' ? `"${value}"` : String(value)}
                                        </div>
                                    );
                                };

                                return (
                                    <div className="border border-slate-200 rounded-lg bg-slate-50 p-3 min-h-[300px] overflow-auto">
                                        {parsed === null ? (
                                            <div className="text-[11px] text-red-500">Invalid JSON. Switch to Raw JSON to fix.</div>
                                        ) : (
                                            renderValue(parsed, '$', 0)
                                        )}
                                    </div>
                                );
                            })()}
                            {editModal.error && (
                                <div className="text-[11px] text-red-600">{editModal.error}</div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setEditModal(null)}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    try {
                                        const parsed = JSON.parse(editModal.json);
                                        updateNodeFromJson(editModal.nodeId, parsed);
                                        setEditModal(null);
                                    } catch (error) {
                                        setEditModal(prev => prev ? { ...prev, error: error instanceof Error ? error.message : 'Invalid JSON' } : prev);
                                    }
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ProfileTreeNode = ({
    node,
    levelIndex,
    ancestorPaths,
    selectNode,
    selectedNode,
    valueTree,
    onMenu
}: {
    node: MappedNode;
    levelIndex: number;
    ancestorPaths: PathSegment[][];
    selectNode: (node: JsonNode) => void;
    selectedNode: JsonNode | null;
    valueTree: JsonNode;
    onMenu: (event: React.MouseEvent, levelIndex: number, parentPath: PathSegment[], ancestorPaths: PathSegment[][]) => void;
}) => {
    const [open, setOpen] = useState(true);
    const resolvedNode = findJsonNodeByPath(valueTree, node.path);
    const isSelected = resolvedNode && selectedNode?.id === resolvedNode.id;
    const hasChildren = Boolean(node.children && node.children.length > 0);

    return (
        <div className="space-y-1">
            <div
                className={clsx(
                    "flex items-center gap-2 text-[11px] font-medium text-slate-600 px-2 py-1 rounded hover:bg-slate-100",
                    isSelected && "bg-blue-50 text-blue-700"
                )}
            >
                <button
                    type="button"
                    onClick={() => {
                        setOpen(prev => !prev);
                        if (resolvedNode) selectNode(resolvedNode);
                    }}
                    className="flex items-center gap-2 flex-1 text-left"
                >
                    {hasChildren && (
                        <ChevronRight className={clsx("w-3 h-3 transition-transform", open && "rotate-90")} />
                    )}
                    <span className="truncate">{node.title}</span>
                </button>
                <button
                    type="button"
                    onClick={(event) => onMenu(event, levelIndex, node.path, [...ancestorPaths, node.path])}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400"
                    aria-label="Open node menu"
                >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
            </div>
            {hasChildren && open && (
                <div className="space-y-1 pl-3">
                    {node.children!.map(child => (
                        <ProfileTreeNode
                            key={child.id}
                            node={child}
                            levelIndex={levelIndex + 1}
                            ancestorPaths={[...ancestorPaths, node.path]}
                            selectNode={selectNode}
                            selectedNode={selectedNode}
                            valueTree={valueTree}
                            onMenu={onMenu}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
