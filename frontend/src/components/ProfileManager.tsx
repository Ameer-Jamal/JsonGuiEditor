import React, { useMemo, useRef, useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { Upload, Download, Info } from 'lucide-react';
import { findJsonNodeById, jsonTreeToValue } from '../schema';
import { type JsonNode, type MappingProfile } from '../types';
import { clsx } from 'clsx';
import { createEmptyLevel, createEmptyProfile } from '../layoutProfiles';
import {
    DndContext,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export const ProfileManager = () => {
    const {
        profiles,
        activeProfileId,
        layoutMode,
        setLayoutMode,
        setActiveProfileId,
        createProfile,
        importProfile,
        exportProfile,
        updateProfileMeta,
        updateProfileLevel,
        updateProfileFieldAttributes,
        addProfileLevel,
        removeProfileLevel,
        reorderProfileLevels,
        replaceProfile,
        valueTree,
        selectedPath,
        selectedNode
    } = useEditor();
    const [newProfileName, setNewProfileName] = useState('');
    const importRef = useRef<HTMLInputElement>(null);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [wizardDraft, setWizardDraft] = useState<MappingProfile | null>(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showWizardAdvanced, setShowWizardAdvanced] = useState(false);
    const [pathPicker, setPathPicker] = useState<{ mode: 'live' | 'draft'; levelIndex: number } | null>(null);
    const [pickerStructureView, setPickerStructureView] = useState(true);

    const activeProfile = profiles.find(profile => profile.id === activeProfileId) ?? null;
    const draftProfile = wizardDraft;

    const cloneProfile = (profile: MappingProfile) => JSON.parse(JSON.stringify(profile)) as MappingProfile;

    const handleCreateProfile = () => {
        const name = newProfileName.trim() || `Profile ${profiles.length + 1}`;
        createProfile(name);
        setNewProfileName('');
    };

    const handleExport = () => {
        if (!activeProfileId) return;
        const profile = exportProfile(activeProfileId);
        if (!profile) return;
        const json = JSON.stringify(profile, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${profile.name.replace(/\s+/g, '_').toLowerCase()}.layout.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') return;
                const parsed = JSON.parse(text);
                importProfile(parsed);
            } catch (error) {
                console.error('Failed to import profile:', error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const updateLevelField = (
        index: number,
        field: 'name' | 'path' | 'labelKey' | 'filterKey' | 'filterValues' | 'overridePaths' | 'role',
        value: string
    ) => {
        if (!activeProfileId) return;
        if (field === 'filterValues') {
            const values = value.split(',').map(item => item.trim()).filter(Boolean);
            updateProfileLevel(activeProfileId, index, { filterValues: values });
            return;
        }
        if (field === 'overridePaths') {
            const overrides = value.split(',').map(item => item.trim()).filter(Boolean);
            updateProfileLevel(activeProfileId, index, { overridePaths: overrides });
            return;
        }
        if (field === 'role') {
            updateProfileLevel(activeProfileId, index, { role: value as any });
            return;
        }
        if (field === 'path') {
            const fixed = value
                .trim()
                .replace(/\s*\.\s*/g, '.')
                .replace(/\s*\[\s*/g, '[')
                .replace(/\s*\]\s*/g, ']')
                .replace(/(\])(?=[A-Za-z0-9_])/g, '$1.')
                .replace(/\.+/g, '.')
                .replace(/^\.|\.$/g, '');
            updateProfileLevel(activeProfileId, index, { path: fixed });
            return;
        }
        updateProfileLevel(activeProfileId, index, { [field]: value });
    };

    const updateDraftLevelField = (
        index: number,
        field: 'name' | 'path' | 'labelKey' | 'filterKey' | 'filterValues' | 'overridePaths' | 'role',
        value: string
    ) => {
        setWizardDraft(prev => {
            if (!prev) return prev;
            const levels = [...prev.levels];
            const level = levels[index];
            if (!level) return prev;
            if (field === 'filterValues') {
                const values = value.split(',').map(item => item.trim()).filter(Boolean);
                levels[index] = { ...level, filterValues: values };
            } else if (field === 'overridePaths') {
                const overrides = value.split(',').map(item => item.trim()).filter(Boolean);
                levels[index] = { ...level, overridePaths: overrides };
            } else if (field === 'role') {
                levels[index] = { ...level, role: value as any };
            } else if (field === 'path') {
                const fixed = value
                    .trim()
                    .replace(/\s*\.\s*/g, '.')
                    .replace(/\s*\[\s*/g, '[')
                    .replace(/\s*\]\s*/g, ']')
                    .replace(/(\])(?=[A-Za-z0-9_])/g, '$1.')
                    .replace(/\.+/g, '.')
                    .replace(/^\.|\.$/g, '');
                levels[index] = { ...level, path: fixed };
            } else {
                levels[index] = { ...level, [field]: value } as MappingProfile['levels'][number];
            }
            return { ...prev, levels };
        });
    };

    const addDraftLevel = (initial?: Partial<MappingProfile['levels'][number]>) => {
        setWizardDraft(prev => {
            if (!prev) return prev;
            const nextIndex = prev.levels.length + 1;
            const levels = prev.levels.map((level, index) => {
                if (index === prev.levels.length - 1 && level.role === 'field') {
                    return { ...level, role: 'group' };
                }
                return level;
            });
            const nextLevel = {
                ...createEmptyLevel(`Level ${nextIndex}`, 'field'),
                ...initial
            };
            return { ...prev, levels: [...levels, nextLevel] };
        });
    };

    const removeDraftLevel = (index: number) => {
        setWizardDraft(prev => {
            if (!prev || prev.levels.length <= 1) return prev;
            const levels = prev.levels.filter((_, levelIndex) => levelIndex !== index);
            const lastIndex = levels.length - 1;
            const normalized = levels.map((level, idx) => idx === lastIndex ? { ...level, role: 'field' } : level);
            return { ...prev, levels: normalized };
        });
    };

    const reorderDraftLevels = (fromIndex: number, toIndex: number) => {
        setWizardDraft(prev => {
            if (!prev || fromIndex === toIndex) return prev;
            const levels = [...prev.levels];
            const [moved] = levels.splice(fromIndex, 1);
            levels.splice(toIndex, 0, moved);
            const lastIndex = levels.length - 1;
            const normalized = levels.map((level, idx) => idx === lastIndex ? { ...level, role: 'field' } : level);
            return { ...prev, levels: normalized };
        });
    };

    const updateDraftFieldAttributes = (value: string) => {
        setWizardDraft(prev => {
            if (!prev) return prev;
            const attrs = value.split(',').map(item => item.trim()).filter(Boolean);
            return { ...prev, fieldAttributes: attrs };
        });
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!activeProfileId || !activeProfile) return;
        if (!over || active.id === over.id) return;
        const ids = activeProfile.levels.map(level => level.id);
        const fromIndex = ids.indexOf(active.id as string);
        const toIndex = ids.indexOf(over.id as string);
        if (fromIndex === -1 || toIndex === -1) return;
        reorderProfileLevels(activeProfileId, fromIndex, toIndex);
    };

    const handleDraftDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!draftProfile) return;
        if (!over || active.id === over.id) return;
        const ids = draftProfile.levels.map(level => level.id);
        const fromIndex = ids.indexOf(active.id as string);
        const toIndex = ids.indexOf(over.id as string);
        if (fromIndex === -1 || toIndex === -1) return;
        reorderDraftLevels(fromIndex, toIndex);
    };

    const SortableLevelItem = ({
        level,
        index,
        compact,
        onRemove,
        onUpdate,
        disableRemove,
        showAdvancedOptions
    }: {
        level: MappingProfile['levels'][number];
        index: number;
        compact: boolean;
        onRemove: (levelIndex: number) => void;
        onUpdate: (
            levelIndex: number,
            field: 'name' | 'path' | 'labelKey' | 'filterKey' | 'filterValues' | 'overridePaths' | 'role',
            value: string
        ) => void;
        disableRemove: boolean;
        showAdvancedOptions: boolean;
    }) => {
        const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: level.id });
        const style = {
            transform: CSS.Transform.toString(transform),
            transition
        };

        return (
            <div
                ref={setNodeRef}
                style={style}
                className={compact ? 'border border-slate-200 rounded-lg p-3 space-y-2 bg-white' : 'border border-slate-200 rounded-lg p-2 bg-white space-y-2'}
            >
                <div className="flex items-center justify-between">
                    <div className={compact ? 'text-xs font-semibold text-slate-500' : 'text-[11px] font-semibold text-slate-500'}>
                        {`Level ${index + 1}`}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="text-[10px] text-slate-400 hover:text-slate-600 cursor-grab"
                            {...attributes}
                            {...listeners}
                        >
                            Drag
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemove(index)}
                            className="text-[10px] text-slate-400 hover:text-slate-600"
                            disabled={disableRemove}
                        >
                            Remove
                        </button>
                    </div>
                </div>
                <input
                    type="text"
                    value={level.name}
                    onChange={(e) => onUpdate(index, 'name', e.target.value)}
                    className={compact ? 'input-field text-sm w-full' : 'input-field text-xs w-full'}
                    placeholder="Level name"
                />
                <select
                    value={level.role ?? 'group'}
                    onChange={(e) => onUpdate(index, 'role', e.target.value)}
                    className={compact ? 'input-field text-sm w-full' : 'input-field text-xs w-full'}
                >
                    <option value="tab">Tab (top level)</option>
                    <option value="group">Group</option>
                    <option value="field">Field (leaf)</option>
                </select>
                <input
                    type="text"
                    value={level.path}
                    onChange={(e) => onUpdate(index, 'path', e.target.value)}
                    className={compact ? 'input-field text-sm w-full' : 'input-field text-xs w-full'}
                    placeholder="Pick from auto-detect or use selected path"
                />
                <p className="text-[10px] text-slate-400">
                    Path = where the list lives in JSON. Example: <span className="font-mono">classes[*]</span>
                </p>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => selectedPathText && onUpdate(index, 'path', selectedPathText)}
                        className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
                        disabled={!selectedPathText}
                    >
                        Use selected path
                    </button>
                    <button
                        type="button"
                        onClick={() => openPathPicker(compact ? 'draft' : 'live', index)}
                        className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50"
                    >
                        Pick from tree
                    </button>
                    {selectedKeys.length > 0 && (
                        <select
                            value=""
                            onChange={(e) => onUpdate(index, 'labelKey', e.target.value)}
                            className="input-field text-[10px]"
                        >
                            <option value="">Use label key...</option>
                            {selectedKeys.map(key => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                    )}
                </div>
                {showAdvancedOptions && !compact && (
                    <>
                        <input
                            type="text"
                            value={level.overridePaths?.join(', ') ?? ''}
                            onChange={(e) => onUpdate(index, 'overridePaths', e.target.value)}
                            className="input-field text-xs w-full"
                            placeholder="Also include paths (comma separated)"
                        />
                        <p className="text-[10px] text-slate-400">
                            Also include items from other lists at different paths.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="text"
                                value={level.labelKey ?? ''}
                                onChange={(e) => onUpdate(index, 'labelKey', e.target.value)}
                                className="input-field text-xs w-full"
                                placeholder="Label key (e.g., name)"
                            />
                            <input
                                type="text"
                                value={level.filterKey ?? ''}
                                onChange={(e) => onUpdate(index, 'filterKey', e.target.value)}
                                className="input-field text-xs w-full"
                                placeholder="Filter key (e.g., type)"
                            />
                        </div>
                        <input
                            type="text"
                            value={level.filterValues?.join(', ') ?? ''}
                            onChange={(e) => onUpdate(index, 'filterValues', e.target.value)}
                            className="input-field text-xs w-full"
                            placeholder="Filter values (comma separated)"
                        />
                        <p className="text-[10px] text-slate-400">
                            Filters keep only items where <span className="font-mono">filterKey</span> matches one of the values.
                        </p>
                    </>
                )}
                {showAdvancedOptions && compact && (
                    <>
                        <input
                            type="text"
                            value={level.filterKey ?? ''}
                            onChange={(e) => onUpdate(index, 'filterKey', e.target.value)}
                            className="input-field text-sm w-full"
                            placeholder="Filter key (e.g., type)"
                        />
                        <input
                            type="text"
                            value={level.filterValues?.join(', ') ?? ''}
                            onChange={(e) => onUpdate(index, 'filterValues', e.target.value)}
                            className="input-field text-sm w-full"
                            placeholder="Filter values (comma separated)"
                        />
                        <p className="text-[10px] text-slate-400">
                            Example: filterKey <span className="font-mono">type</span>, values <span className="font-mono">STUDENT</span>
                        </p>
                    </>
                )}
            </div>
        );
    };

    const renderLevelEditorList = (
        levels: MappingProfile['levels'],
        compact: boolean,
        onDragEndHandler: (event: DragEndEvent) => void,
        onRemove: (index: number) => void,
        onUpdate: (
            levelIndex: number,
            field: 'name' | 'path' | 'labelKey' | 'filterKey' | 'filterValues' | 'overridePaths' | 'role',
            value: string
        ) => void,
        disableRemove: boolean,
        showAdvancedOptions: boolean
    ) => {
        return (
            <DndContext sensors={sensors} onDragEnd={onDragEndHandler}>
                <SortableContext items={levels.map(level => level.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                        {levels.map((level, index) => (
                            <SortableLevelItem
                                key={level.id}
                                level={level}
                                index={index}
                                compact={compact}
                                onRemove={onRemove}
                                onUpdate={onUpdate}
                                disableRemove={disableRemove}
                                showAdvancedOptions={showAdvancedOptions}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        );
    };

    const selectedKeys = useMemo(() => {
        if (!selectedNode) return [];
        if (selectedNode.type === 'object') {
            return (selectedNode.children ?? []).map(child => child.key).filter(Boolean) as string[];
        }
        if (selectedNode.type === 'array') {
            const first = selectedNode.children?.[0];
            if (first?.type === 'object') {
                return (first.children ?? []).map(child => child.key).filter(Boolean) as string[];
            }
        }
        return [];
    }, [selectedNode]);

    const pathSegmentsToWildcardPath = (segments: typeof selectedPath) => {
        if (!segments.length) return '';
        const parts: string[] = [];
        segments.forEach(segment => {
            if (segment.kind === 'object') {
                parts.push(segment.key);
            } else {
                if (parts.length === 0) {
                    parts.push('[*]');
                } else {
                    parts[parts.length - 1] = `${parts[parts.length - 1]}[*]`;
                }
            }
        });
        return parts.join('.');
    };

    const selectedPathText = pathSegmentsToWildcardPath(selectedPath);
    const formatPathLabel = (path: string) =>
        path.replace(/\[\*\]/g, '[]').split('.').filter(Boolean).join(' → ');

    const openPathPicker = (mode: 'live' | 'draft', levelIndex: number) => {
        setPathPicker({ mode, levelIndex });
    };

    const buildArrayPathFromSegments = (segments: typeof selectedPath) => {
        const base = pathSegmentsToWildcardPath(segments);
        if (!base) return '[*]';
        if (base.endsWith('[*]')) return `${base}.[*]`;
        return `${base}[*]`;
    };

    const applyPickedPath = (nodeId: string) => {
        const found = findJsonNodeById(valueTree, nodeId);
        if (!found) return;
        if (found.node.type !== 'array') return;
        const pathText = buildArrayPathFromSegments(found.path);
        if (!pathText) return;
        if (pathPicker?.mode === 'draft') {
            updateDraftLevelField(pathPicker.levelIndex, 'path', pathText);
        } else {
            updateLevelField(pathPicker.levelIndex, 'path', pathText);
        }
        setPathPicker(null);
    };

    const renderPathTree = (node: JsonNode, depth = 0) => {
        const label = node.key ?? (depth === 0 ? 'root' : '');
        const isArray = node.type === 'array';
        const childrenToRender = isArray && pickerStructureView
            ? node.children?.slice(0, 1) ?? []
            : node.children ?? [];
        return (
            <div key={node.id} className="space-y-1">
                <button
                    type="button"
                    onClick={() => {
                        if (isArray) applyPickedPath(node.id);
                    }}
                    className={`w-full flex items-center gap-2 text-left text-[12px] px-2 py-1 rounded ${
                        isArray ? 'bg-white border border-slate-200 hover:bg-slate-50' : 'text-slate-500'
                    }`}
                    style={{ marginLeft: depth * 12 }}
                >
                    <span className="text-[10px] text-slate-400 uppercase">{node.type}</span>
                    <span className="truncate">{label || node.type}</span>
                </button>
                {childrenToRender.length > 0 && (
                    <div className="space-y-1">
                        {childrenToRender.map(child => renderPathTree(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    type ArraySuggestion = {
        path: string;
        depth: number;
        sampleKeys: string[];
        suggestedLabelKey?: string;
    };

    const commonLabelKeys = ['name', 'title', 'label', 'id'];

    const collectArraySuggestions = (value: unknown): ArraySuggestion[] => {
        const suggestions: ArraySuggestion[] = [];

        const pushSuggestion = (pathParts: string[], depth: number, sampleKeys: string[]) => {
            if (!pathParts.length) return;
            const path = pathParts.join('.');
            if (suggestions.some(item => item.path === path)) return;
            const suggestedLabelKey = commonLabelKeys.find(key => sampleKeys.includes(key));
            suggestions.push({ path, depth, sampleKeys, suggestedLabelKey });
        };

        const walk = (node: unknown, pathParts: string[], depth: number) => {
            if (Array.isArray(node)) {
                const sample = node.find(item => item && typeof item === 'object') as Record<string, unknown> | undefined;
                const sampleKeys = sample ? Object.keys(sample) : [];
                if (pathParts.length === 0) {
                    pushSuggestion(['[*]'], depth, sampleKeys);
                } else {
                    const lastIndex = pathParts.length - 1;
                    const last = pathParts[lastIndex];
                    const withArray = last.endsWith('[*]') ? last : `${last}[*]`;
                    const nextParts = [...pathParts];
                    nextParts[lastIndex] = withArray;
                    pushSuggestion(nextParts, depth, sampleKeys);
                }

                const itemsToScan = node.slice(0, 3);
                itemsToScan.forEach(item => walk(item, pathParts, depth + 1));
                return;
            }

            if (node && typeof node === 'object') {
                Object.entries(node as Record<string, unknown>).forEach(([key, value]) => {
                    walk(value, [...pathParts, key], depth + 1);
                });
            }
        };

        walk(value, [], 0);
        return suggestions.sort((a, b) => a.depth - b.depth);
    };

    const autoSuggestions = useMemo(() => collectArraySuggestions(jsonTreeToValue(valueTree)), [valueTree]);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>Layout Mode</span>
                <select
                    value={layoutMode}
                    onChange={(e) => setLayoutMode(e.target.value as 'auto' | 'profile')}
                    className="input-field text-[11px]"
                >
                    <option value="auto">Auto</option>
                    <option value="profile">Profile</option>
                </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <select
                    value={activeProfileId ?? ''}
                    onChange={(e) => setActiveProfileId(e.target.value || null)}
                    className="input-field text-xs flex-1"
                >
                    <option value="">Select Profile</option>
                    {profiles.map(profile => (
                        <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                </select>
                <button
                    onClick={handleExport}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1"
                    title="Export Profile"
                >
                    <Download className="w-3 h-3" />
                    <span>Export</span>
                </button>
                <button
                    onClick={() => importRef.current?.click()}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 flex items-center gap-1"
                    title="Import Profile"
                >
                    <Upload className="w-3 h-3" />
                    <span>Import</span>
                </button>
                <button
                    onClick={() => setIsInfoOpen(true)}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50"
                    title="How profiles work"
                >
                    <Info className="w-3 h-3" />
                </button>
                <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </div>

            <button
                onClick={() => {
                    if (activeProfile) {
                        setWizardDraft(cloneProfile(activeProfile));
                        setWizardStep(2);
                    } else {
                        setWizardDraft(null);
                        setWizardStep(1);
                    }
                    setIsWizardOpen(true);
                }}
                className="w-full px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
                Open Profile Wizard
            </button>

            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="input-field text-xs flex-1"
                    placeholder="New profile name"
                />
                <button
                    onClick={handleCreateProfile}
                    className="px-2 py-1 text-[11px] font-medium text-white bg-slate-900 rounded hover:bg-slate-800"
                >
                    Create
                </button>
            </div>

            {activeProfile && (
                <div className="space-y-2">
                    <div className="space-y-3">
                        {renderLevelEditorList(
                            activeProfile.levels,
                            false,
                            handleDragEnd,
                            (index) => activeProfileId && removeProfileLevel(activeProfileId, index),
                            updateLevelField,
                            activeProfile.levels.length === 1,
                            showAdvanced
                        )}
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(prev => !prev)}
                            className="px-2 py-1 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50"
                        >
                            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
                        </button>
                        <button
                            type="button"
                            onClick={() => activeProfileId && addProfileLevel(activeProfileId)}
                            className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 rounded hover:bg-slate-200"
                        >
                            Add Level
                        </button>
                        <input
                            type="text"
                            value={activeProfile.fieldAttributes.join(', ')}
                            onChange={(e) => updateProfileFieldAttributes(activeProfile.id, e.target.value.split(',').map(item => item.trim()).filter(Boolean))}
                            className="input-field text-xs w-full"
                            placeholder="Field attributes (comma separated)"
                        />
                    </div>
                </div>
            )}

            {isWizardOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-w-[96vw] h-[65vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Profile Wizard</h3>
                                <p className="text-[11px] text-slate-400">Step {wizardStep} of 3</p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsWizardOpen(false);
                                    setWizardDraft(null);
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                            {wizardStep === 1 && (
                                <>
                                    <p className="text-sm text-slate-600">
                                        Create a profile to define how your JSON is grouped into tabs and sections.
                                    </p>
                                    <input
                                        type="text"
                                        value={newProfileName}
                                        onChange={(e) => setNewProfileName(e.target.value)}
                                        className="input-field w-full"
                                        placeholder="Profile name"
                                    />
                                    <button
                                        onClick={() => {
                                            const name = newProfileName.trim() || `Profile ${profiles.length + 1}`;
                                            const draft = createEmptyProfile(name);
                                            setWizardDraft(draft);
                                            setWizardStep(2);
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg"
                                    >
                                        Start Profile
                                    </button>
                                </>
                            )}

                            {wizardStep === 2 && draftProfile && (
                                <>
                                    <p className="text-sm text-slate-600">
                                        Define how to walk your JSON: level names, paths, and filters.
                                    </p>
                                    <div className="space-y-3">
                                        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                                            <div className="text-xs font-semibold text-slate-600 mb-2">Auto-detect arrays</div>
                                            <p className="text-[11px] text-slate-500 mb-2">
                                                We scan your JSON for arrays and suggest level paths. Pick one to add.
                                            </p>
                                            <p className="text-[11px] text-slate-500 mb-2">
                                                Tip: Arrays are the things you want to list (schools, classes, students).
                                            </p>
                                            <div className="space-y-2 max-h-40 overflow-auto">
                                                {autoSuggestions.length === 0 && (
                                                    <div className="text-[11px] text-slate-400">No arrays found in the current JSON.</div>
                                                )}
                                                {autoSuggestions.map(item => (
                                                    <div key={item.path} className="flex items-center justify-between gap-2 text-[11px]">
                                                        <div className="text-slate-600">
                                                            <div className="truncate">{formatPathLabel(item.path) || item.path}</div>
                                                            <div className="text-[10px] text-slate-400">{item.path}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {item.suggestedLabelKey && (
                                                                <span className="text-slate-400">label: {item.suggestedLabelKey}</span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    addDraftLevel({
                                                                        path: item.path,
                                                                        labelKey: item.suggestedLabelKey ?? 'name',
                                                                        name: item.path.split('.').slice(-1)[0]?.replace('[*]', '') || 'Level'
                                                                    });
                                                                }}
                                                                className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50"
                                                            >
                                                                Add level
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {renderLevelEditorList(
                                            draftProfile.levels,
                                            true,
                                            handleDraftDragEnd,
                                            removeDraftLevel,
                                            updateDraftLevelField,
                                            draftProfile.levels.length === 1,
                                            showWizardAdvanced
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setShowWizardAdvanced(prev => !prev)}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                                        >
                                            {showWizardAdvanced ? 'Hide advanced options' : 'Show advanced options'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => addDraftLevel()}
                                            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                                        >
                                            Add Level
                                        </button>
                                    </div>
                                </>
                            )}

                            {wizardStep === 3 && (
                                <>
                                    <p className="text-sm text-slate-600">
                                        Define the field attributes you want to surface (label, width, etc.).
                                    </p>
                                    {draftProfile && (
                                        <input
                                            type="text"
                                            value={draftProfile.fieldAttributes.join(', ')}
                                            onChange={(e) => updateDraftFieldAttributes(e.target.value)}
                                            className="input-field text-sm w-full"
                                            placeholder="Field attributes (comma separated)"
                                        />
                                    )}
                                </>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                            <button
                                onClick={() => setWizardStep(step => Math.max(1, step - 1))}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg"
                                disabled={wizardStep === 1}
                            >
                                Back
                            </button>
                            {wizardStep < 3 ? (
                                <button
                                    onClick={() => setWizardStep(step => Math.min(3, step + 1))}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg"
                                    disabled={wizardStep === 1 && !draftProfile}
                                >
                                    Next
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (draftProfile) {
                                            replaceProfile(draftProfile);
                                        }
                                        setIsWizardOpen(false);
                                        setWizardDraft(null);
                                    }}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg"
                                >
                                    Apply Profile
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isInfoOpen && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-w-[96vw] h-[65vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">How Profiles Work</h3>
                                <p className="text-[11px] text-slate-400">Quick guide for non-technical users</p>
                            </div>
                            <button
                                onClick={() => setIsInfoOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 text-sm text-slate-600">
                            <p>
                                Profiles turn your JSON into a simple navigation hierarchy (like Schools → Classes → Students).
                                Each level usually maps to an array (a list of items).
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-[13px]">
                                <li>Each level maps to an array in the JSON (lists like schools, classes, students).</li>
                                <li>A path like <span className="font-mono">classes[*]</span> means “each item in the classes list.”</li>
                                <li>The last level (leaf) is what you edit directly.</li>
                                <li>If the leaf points to an object (like a student), you can edit its fields (height, gender, grades) without extra levels.</li>
                            </ul>
                            <div className="text-[13px] text-slate-500 space-y-1">
                                <div><span className="font-semibold">Filters</span>: keep only items where a key matches specific values.</div>
                                <div className="text-[12px] text-slate-400">Example: filterKey = <span className="font-mono">type</span>, values = <span className="font-mono">STUDENT</span>.</div>
                                <div><span className="font-semibold">Also include paths</span>: add items from other lists into the same level.</div>
                                <div className="text-[12px] text-slate-400">Example: include <span className="font-mono">students[*]</span> and <span className="font-mono">transfers[*]</span>.</div>
                            </div>
                            <div className="text-[13px] text-slate-500">
                                Tip: Use the “Auto-detect arrays” list in the wizard to add levels without typing paths.
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setIsInfoOpen(false)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pathPicker && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-w-[96vw] h-[65vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Pick a list</h3>
                                <p className="text-[11px] text-slate-400">Select an array to build the path</p>
                            </div>
                            <button
                                onClick={() => setPathPicker(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 space-y-3 overflow-y-auto flex-1 min-h-0">
                            <p className="text-[12px] text-slate-500">
                                Arrays are lists of things (schools, classes, students). Only array nodes are selectable.
                            </p>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>Structure View</span>
                                <button
                                    type="button"
                                    onClick={() => setPickerStructureView(prev => !prev)}
                                    className={clsx(
                                        "px-2 py-1 text-[11px] font-medium rounded border transition-colors",
                                        pickerStructureView
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    )}
                                >
                                    {pickerStructureView ? 'On' : 'Off'}
                                </button>
                            </div>
                            <div className="space-y-2">
                                {renderPathTree(valueTree)}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setPathPicker(null)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
