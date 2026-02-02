import React, { createContext, useCallback, useContext, useMemo, useReducer, useState } from 'react';
import { type JsonNode, type MappingLevel, type MappingProfile, type PathSegment, type SchemaNode, type SchemaType } from '../types';
import {
    buildJsonTree,
    cloneJsonNode,
    cloneSchemaNode,
    coerceValueForType,
    createJsonNode,
    createSchemaNode,
    findJsonNodeById,
    findJsonNodeByPath,
    findSchemaNodeByPath,
    inferSchemaFromJson,
    jsonTreeToValue,
    updateJsonNodeType
} from '../schema';
import { addMappedItem } from '../profileMapping';
import {
    createEmptyProfile,
    createFormLayoutProfile,
    loadActiveProfileId,
    loadLayoutMode,
    loadProfiles,
    saveActiveProfileId,
    saveLayoutMode,
    saveProfiles,
    type LayoutMode
} from '../layoutProfiles';

const INITIAL_DATA: unknown = {};

interface EditorContextType {
    schema: SchemaNode;
    valueTree: JsonNode;
    selectedNode: JsonNode | null;
    selectedSchemaNode: SchemaNode | null;
    selectedParent: JsonNode | null;
    selectedPath: PathSegment[];
    profiles: MappingProfile[];
    activeProfileId: string | null;
    activeProfile: MappingProfile | null;
    layoutMode: LayoutMode;
    setLayoutMode: (mode: LayoutMode) => void;
    createProfile: (name: string) => void;
    importProfile: (profile: MappingProfile) => void;
    exportProfile: (id: string) => MappingProfile | null;
    setActiveProfileId: (id: string | null) => void;
    updateProfileMeta: (profileId: string, name: string, description?: string) => void;
    updateProfileLevel: (profileId: string, levelIndex: number, update: Partial<MappingLevel>) => void;
    updateProfileFieldAttributes: (profileId: string, attrs: string[]) => void;
    addProfileNode: (levelIndex: number, parentPath: PathSegment[]) => void;
    selectNode: (node: JsonNode | null) => void;
    setFromJson: (raw: unknown) => void;
    updateNodeValue: (id: string, value: unknown) => void;
    updateNodeKey: (id: string, key: string) => void;
    updateNodeType: (id: string, type: SchemaType) => void;
    updateArrayItemType: (id: string, type: SchemaType) => void;
    updateEnumValues: (id: string, values: string[]) => void;
    updateNodeFromJson: (id: string, raw: unknown) => void;
    addChildNode: (parentId: string, type: SchemaType) => void;
    deleteNode: (id: string) => void;
    moveNode: (activeId: string, overId: string) => void;
    getRawJson: () => string;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

const ensureUniqueKey = (parent: JsonNode, desiredKey: string): string => {
    const existing = new Set((parent.children ?? []).map(child => child.key).filter(Boolean) as string[]);
    if (!existing.has(desiredKey)) return desiredKey;
    let counter = 1;
    let candidate = `${desiredKey}_${counter}`;
    while (existing.has(candidate)) {
        counter += 1;
        candidate = `${desiredKey}_${counter}`;
    }
    return candidate;
};

const replaceNode = (root: JsonNode, targetId: string, updatedNode: JsonNode): JsonNode => {
    if (root.id === targetId) return updatedNode;
    if (!root.children) return root;
    return {
        ...root,
        children: root.children.map(child => replaceNode(child, targetId, updatedNode))
    };
};

const updateSchemaAtPath = (root: SchemaNode, path: PathSegment[], updater: (current: SchemaNode) => SchemaNode): SchemaNode => {
    if (path.length === 0) {
        return updater(root);
    }
    const next = path[0];
    if (next.kind === 'object') {
        const nextProps = root.properties ? { ...root.properties } : {};
        const currentChild = nextProps[next.key] ?? createSchemaNode('any');
        nextProps[next.key] = updateSchemaAtPath(currentChild, path.slice(1), updater);
        return {
            ...root,
            properties: nextProps
        };
    }
    return {
        ...root,
        items: root.items ? updateSchemaAtPath(root.items, path.slice(1), updater) : updateSchemaAtPath(createSchemaNode('any'), path.slice(1), updater)
    };
};

export function EditorProvider({ children }: Readonly<{ children: React.ReactNode }>) {
    const [schema, setSchema] = useState<SchemaNode>(() => inferSchemaFromJson(INITIAL_DATA));
    const [valueTree, setValueTree] = useState<JsonNode>(() => buildJsonTree(INITIAL_DATA));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [profiles, setProfiles] = useState<MappingProfile[]>(() => loadProfiles());
    const [activeProfileId, setActiveProfileIdState] = useReducer(
        (_: string | null, next: string | null) => next,
        loadActiveProfileId()
    );
    const [layoutMode, setLayoutModeState] = useReducer(
        (_: LayoutMode, next: LayoutMode) => next,
        loadLayoutMode()
    );

    const selectedMeta = useMemo(() => {
        if (!selectedId) return { node: null, schemaNode: null, parent: null, path: [] as PathSegment[] };
        const found = findJsonNodeById(valueTree, selectedId);
        if (!found) return { node: null, schemaNode: null, parent: null, path: [] as PathSegment[] };
        return {
            node: found.node,
            parent: found.parent,
            path: found.path,
            schemaNode: findSchemaNodeByPath(schema, found.path)
        };
    }, [schema, selectedId, valueTree]);

    const setFromJson = (raw: unknown) => {
        const nextSchema = inferSchemaFromJson(raw);
        const nextTree = buildJsonTree(raw);
        setSchema(nextSchema);
        setValueTree(nextTree);
        setSelectedId(null);

        const formProfile = createFormLayoutProfile(raw);
        if (formProfile && !profiles.some(profile => profile.name === formProfile.name)) {
            setProfiles(prev => {
                const next = [...prev, formProfile];
                saveProfiles(next);
                return next;
            });
            setActiveProfileIdState(formProfile.id);
            saveActiveProfileId(formProfile.id);
            setLayoutModeState('profile');
            saveLayoutMode('profile');
        }
    };

    const updateNodeValue = (id: string, value: unknown) => {
        const cloned = cloneJsonNode(valueTree);
        const found = findJsonNodeById(cloned, id);
        if (!found) return;
        if (found.node.type === 'object' || found.node.type === 'array') return;
        found.node.value = coerceValueForType(value, found.node.type);
        setValueTree(cloned);
    };

    const updateNodeKey = (id: string, key: string) => {
        const trimmed = key.trim();
        if (!trimmed) return;
        const clonedTree = cloneJsonNode(valueTree);
        const clonedSchema = cloneSchemaNode(schema);
        const found = findJsonNodeById(clonedTree, id);
        if (found?.parent?.type !== 'object') return;

        const safeKey = ensureUniqueKey(found.parent, trimmed);
        const previousKey = found.node.key ?? safeKey;
        found.node.key = safeKey;

        const parentPath = found.path.slice(0, -1);
        const parentSchema = findSchemaNodeByPath(clonedSchema, parentPath);
        if (parentSchema?.properties) {
            const existing = parentSchema.properties[previousKey] ?? createSchemaNode(found.node.type);
            parentSchema.properties[safeKey] = existing;
            if (previousKey !== safeKey) {
                delete parentSchema.properties[previousKey];
            }
            if (parentSchema.propertyOrder) {
                parentSchema.propertyOrder = parentSchema.propertyOrder.map(item => (item === previousKey ? safeKey : item));
            }
        }

        setSchema(clonedSchema);
        setValueTree(clonedTree);
    };

    const updateNodeType = (id: string, type: SchemaType) => {
        const clonedTree = cloneJsonNode(valueTree);
        const clonedSchema = cloneSchemaNode(schema);
        const found = findJsonNodeById(clonedTree, id);
        if (!found) return;

        if (found.parent?.type === 'array') {
            updateArrayItemType(found.parent.id, type);
            return;
        }

        const updatedNode = updateJsonNodeType(found.node, type);
        const nextTree = replaceNode(clonedTree, id, updatedNode);
        const nextSchema = updateSchemaAtPath(clonedSchema, found.path, () => createSchemaNode(type));

        setSchema(nextSchema);
        setValueTree(nextTree);
    };

    const updateArrayItemType = (id: string, type: SchemaType) => {
        const clonedTree = cloneJsonNode(valueTree);
        const clonedSchema = cloneSchemaNode(schema);
        const found = findJsonNodeById(clonedTree, id);
        if (found?.node.type !== 'array') return;

        found.node.children = (found.node.children ?? []).map(child => updateJsonNodeType(child, type));
        const nextSchema = updateSchemaAtPath(clonedSchema, found.path, current => {
            if (current.type !== 'array') return current;
            return {
                ...current,
                items: createSchemaNode(type)
            };
        });

        setSchema(nextSchema);
        setValueTree(clonedTree);
    };

    const updateEnumValues = (id: string, values: string[]) => {
        const clonedSchema = cloneSchemaNode(schema);
        const found = findJsonNodeById(valueTree, id);
        if (!found) return;
        const nextSchema = updateSchemaAtPath(clonedSchema, found.path, current => ({
            ...current,
            enum: values.length > 0 ? values : undefined
        }));
        setSchema(nextSchema);
    };

    const updateNodeFromJson = (id: string, raw: unknown) => {
        const clonedTree = cloneJsonNode(valueTree);
        const clonedSchema = cloneSchemaNode(schema);
        const found = findJsonNodeById(clonedTree, id);
        if (!found) return;

        const nextNode = buildJsonTree(raw, found.node.key);
        nextNode.id = found.node.id;
        const nextTree = replaceNode(clonedTree, id, nextNode);
        const nextSchema = updateSchemaAtPath(clonedSchema, found.path, () => inferSchemaFromJson(raw));

        setSchema(nextSchema);
        setValueTree(nextTree);
    };

    const addChildNode = (parentId: string, type: SchemaType) => {
        const clonedTree = cloneJsonNode(valueTree);
        const clonedSchema = cloneSchemaNode(schema);
        const found = findJsonNodeById(clonedTree, parentId);
        if (!found) return;

        if (found.node.type === 'object') {
            const baseKey = 'newProperty';
            const uniqueKey = ensureUniqueKey(found.node, baseKey);
            const newChild = createJsonNode(type, uniqueKey);
            found.node.children = [...(found.node.children ?? []), newChild];
            const nextSchema = updateSchemaAtPath(clonedSchema, found.path, current => {
                if (current.type !== 'object') return current;
                const nextProperties = current.properties ? { ...current.properties } : {};
                nextProperties[uniqueKey] = createSchemaNode(type);
                const nextOrder = [...(current.propertyOrder ?? []), uniqueKey];
                return {
                    ...current,
                    properties: nextProperties,
                    propertyOrder: nextOrder,
                    required: [...(current.required ?? []), uniqueKey]
                };
            });
            setSchema(nextSchema);
            setValueTree(clonedTree);
            return;
        }

        if (found.node.type === 'array') {
            const parentSchema = findSchemaNodeByPath(clonedSchema, found.path);
            const itemType = parentSchema?.items?.type && parentSchema.items.type !== 'any' ? parentSchema.items.type : type;
            const newChild = createJsonNode(itemType);
            found.node.children = [...(found.node.children ?? []), newChild];
            const nextSchema = updateSchemaAtPath(clonedSchema, found.path, current => {
                if (current.type !== 'array') return current;
                return {
                    ...current,
                    items: createSchemaNode(itemType)
                };
            });
            setSchema(nextSchema);
            setValueTree(clonedTree);
        }
    };

    const deleteNode = (id: string) => {
        const clonedTree = cloneJsonNode(valueTree);
        const clonedSchema = cloneSchemaNode(schema);
        const found = findJsonNodeById(clonedTree, id);
        if (!found?.parent) return;
        const parent = found.parent;
        parent.children = (parent.children ?? []).filter(child => child.id !== id);
        if (parent.type === 'object' && found.node.key) {
            const parentPath = found.path.slice(0, -1);
            const nextSchema = updateSchemaAtPath(clonedSchema, parentPath, current => {
                if (current.type !== 'object') return current;
                const nextProperties = current.properties ? { ...current.properties } : {};
                delete nextProperties[found.node.key!];
                const nextOrder = (current.propertyOrder ?? []).filter(item => item !== found.node.key);
                const nextRequired = (current.required ?? []).filter(item => item !== found.node.key);
                return {
                    ...current,
                    properties: nextProperties,
                    propertyOrder: nextOrder,
                    required: nextRequired
                };
            });
            setSchema(nextSchema);
        } else {
            setSchema(clonedSchema);
        }
        setValueTree(clonedTree);
        if (selectedId === id) setSelectedId(null);
    };

    const moveNode = (activeId: string, overId: string) => {
        const clonedTree = cloneJsonNode(valueTree);
        const clonedSchema = cloneSchemaNode(schema);
        const active = findJsonNodeById(clonedTree, activeId);
        const over = findJsonNodeById(clonedTree, overId);
        if (!active || !over || !active.parent || !over.parent) return;
        if (active.parent.id !== over.parent.id) return;

        const siblings = active.parent.children ?? [];
        const activeIndex = siblings.findIndex(child => child.id === activeId);
        const overIndex = siblings.findIndex(child => child.id === overId);
        if (activeIndex === -1 || overIndex === -1) return;
        const updated = [...siblings];
        const [moved] = updated.splice(activeIndex, 1);
        updated.splice(overIndex, 0, moved);
        active.parent.children = updated;

        if (active.parent.type === 'object') {
            const parentPath = active.path.slice(0, -1);
            const nextSchema = updateSchemaAtPath(clonedSchema, parentPath, current => {
                if (current.type !== 'object') return current;
                const order = updated.map(child => child.key).filter(Boolean) as string[];
                return { ...current, propertyOrder: order };
            });
            setSchema(nextSchema);
        } else {
            setSchema(clonedSchema);
        }

        setValueTree(clonedTree);
    };

    const getRawJson = useCallback(() => JSON.stringify(jsonTreeToValue(valueTree), null, 2), [valueTree]);

    const activeProfile = useMemo(
        () => profiles.find(profile => profile.id === activeProfileId) ?? null,
        [activeProfileId, profiles]
    );

    const setLayoutMode = (mode: LayoutMode) => {
        setLayoutModeState(mode);
        saveLayoutMode(mode);
    };

    const setActiveProfileId = (id: string | null) => {
        setActiveProfileIdState(id);
        saveActiveProfileId(id);
    };

    const updateProfile = (profileId: string, updater: (profile: MappingProfile) => MappingProfile) => {
        setProfiles(prev => {
            const next = prev.map(profile => profile.id === profileId ? updater(profile) : profile);
            saveProfiles(next);
            return next;
        });
    };

    const createProfile = (name: string) => {
        const profile = createEmptyProfile(name);
        setProfiles(prev => {
            const next = [...prev, profile];
            saveProfiles(next);
            return next;
        });
        setActiveProfileId(profile.id);
        setLayoutMode('profile');
    };

    const importProfile = (profile: MappingProfile) => {
        const normalized: MappingProfile = {
            ...profile,
            id: profile.id || createEmptyProfile(profile.name || 'Imported Profile').id,
            createdAt: profile.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setProfiles(prev => {
            const next = [...prev, normalized];
            saveProfiles(next);
            return next;
        });
        setActiveProfileId(normalized.id);
        setLayoutMode('profile');
    };

    const exportProfile = (id: string) => {
        return profiles.find(profile => profile.id === id) ?? null;
    };

    const updateProfileMeta = (profileId: string, name: string, description?: string) => {
        updateProfile(profileId, profile => ({
            ...profile,
            name,
            description: description ?? profile.description,
            updatedAt: new Date().toISOString()
        }));
    };

    const updateProfileLevel = (profileId: string, levelIndex: number, update: Partial<MappingLevel>) => {
        updateProfile(profileId, profile => {
            const levels = profile.levels.map((level, index) =>
                index === levelIndex ? { ...level, ...update } : level
            );
            return { ...profile, levels, updatedAt: new Date().toISOString() };
        });
    };

    const updateProfileFieldAttributes = (profileId: string, attrs: string[]) => {
        updateProfile(profileId, profile => ({
            ...profile,
            fieldAttributes: attrs,
            updatedAt: new Date().toISOString()
        }));
    };

    const addProfileNode = (levelIndex: number, parentPath: PathSegment[]) => {
        if (!activeProfile) return;
        const level = activeProfile.levels[levelIndex];
        if (!level) return;
        const rootValue = jsonTreeToValue(valueTree);
        const result = addMappedItem(rootValue, parentPath, level);
        if (!result) return;
        const nextSchema = inferSchemaFromJson(result.nextRoot);
        const nextTree = buildJsonTree(result.nextRoot);
        setSchema(nextSchema);
        setValueTree(nextTree);
        const newNode = findJsonNodeByPath(nextTree, result.newPath);
        setSelectedId(newNode?.id ?? null);
    };

    const providerValue = useMemo(() => ({
            schema,
            valueTree,
            selectedNode: selectedMeta.node,
            selectedSchemaNode: selectedMeta.schemaNode,
            selectedParent: selectedMeta.parent,
            selectedPath: selectedMeta.path,
            profiles,
            activeProfileId,
            activeProfile,
            layoutMode,
            setLayoutMode,
            createProfile,
            importProfile,
            exportProfile,
            setActiveProfileId,
            updateProfileMeta,
            updateProfileLevel,
            updateProfileFieldAttributes,
            addProfileNode,
            selectNode: node => setSelectedId(node?.id ?? null),
            setFromJson,
            updateNodeValue,
            updateNodeKey,
            updateNodeType,
            updateArrayItemType,
            updateEnumValues,
            updateNodeFromJson,
            addChildNode,
            deleteNode,
            moveNode,
            getRawJson
        }), [
            schema,
            valueTree,
            selectedMeta.node,
            selectedMeta.schemaNode,
            selectedMeta.parent,
            selectedMeta.path,
            profiles,
            activeProfileId,
            activeProfile,
            layoutMode,
            setLayoutMode,
            createProfile,
            importProfile,
            exportProfile,
            setActiveProfileId,
            setSelectedId,
            setFromJson,
            updateNodeValue,
            updateNodeKey,
            updateNodeType,
            updateArrayItemType,
            updateEnumValues,
            addChildNode,
            deleteNode,
            moveNode,
            getRawJson
        ]);

    return (
        <EditorContext.Provider value={providerValue}>
            {children}
        </EditorContext.Provider>
    );
}

export function useEditor() {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error('useEditor must be used within an EditorProvider');
    }
    return context;
}
