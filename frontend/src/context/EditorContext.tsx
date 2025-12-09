import React, { createContext, useContext, useState } from 'react';
import { type FormNode, type BaseNode, type TabNode } from '../types';

// Mock initial data based on user example
const INITIAL_DATA: FormNode = {
    name: "ETQ_DATACENTER_SYSTEM_PREFERENCES_PROFILE",
    type: "FORM",
    tabs: []
};

interface EditorContextType {
    data: FormNode;
    setData: (data: FormNode) => void;
    selectedNode: BaseNode | null;
    selectNode: (node: BaseNode | null) => void;
    updateNode: (updatedNode: BaseNode) => void;
    addNode: (parentNode: BaseNode, type: string) => void;
    deleteNode: (node: BaseNode) => void;
    moveNode: (activeId: string, overId: string) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Helper to ensure all nodes have IDs
const ensureIds = (node: BaseNode): BaseNode => {
    if (!node.id) node.id = generateId();
    if (node.type === 'FORM') {
        (node as FormNode).tabs?.forEach(ensureIds);
    } else if (node.contents?.rows) {
        node.contents.rows.forEach(row => {
            row.contents.forEach(ensureIds);
        });
    }
    return node;
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
    const [data, setDataRaw] = useState<FormNode>(() => ensureIds(INITIAL_DATA) as FormNode);
    const [selectedNode, setSelectedNode] = useState<BaseNode | null>(null);

    const setData = (newData: FormNode) => {
        setDataRaw(ensureIds(newData) as FormNode);
    };

    // Deep update function (placeholder for now, will implement robust tree traversal later)
    // For now, we might just be updating the selected node in place if we passed by reference,
    // but React needs state updates.
    // We'll implementation a proper immutable update logic later.
    const updateNode = (updatedNode: BaseNode) => {
        if (updatedNode.type === 'FORM') {
            setData(updatedNode as FormNode);
            setSelectedNode(updatedNode);
            return;
        }

        // Recursive helper to find and replace node
        const replaceNode = (current: BaseNode, target: BaseNode): BaseNode => {
            if (current.id === target.id) {
                return target;
            }

            // Clone current to avoid mutation if we are going deep
            // But strict immutability requires full cloning path.
            // For now, we will clone the path.

            if (current.type === 'FORM') {
                const form = current as FormNode;
                if (form.tabs) {
                    return {
                        ...form,
                        tabs: form.tabs.map(t => replaceNode(t, target))
                    };
                }
            }

            if (current.contents && current.contents.rows) {
                return {
                    ...current,
                    contents: {
                        ...current.contents,
                        rows: current.contents.rows.map(row => ({
                            ...row,
                            contents: row.contents.map(child => replaceNode(child, target))
                        }))
                    }
                };
            }

            return current;
        };

        const newData = replaceNode(data, updatedNode) as FormNode;
        setData(newData);
        setSelectedNode(updatedNode);
    };

    const addNode = (parentNode: BaseNode, type: string) => {
        // 1. Create new node
        let newNode: BaseNode = {
            id: generateId(),
            name: `New ${type}`,
            type: type as any,
            width: 12,
            offset: 0
        };

        if (type === 'TAB') {
            (newNode as any).contents = { width: 12, cellWidth: 1, rows: [] };
        } else if (type === 'SECTION') {
            (newNode as any).contents = { width: 12, cellWidth: 1, rows: [] };
        }

        // 2. Add to parent
        if (parentNode.type === 'FORM') {
            const form = parentNode as FormNode;
            if (!form.tabs) form.tabs = [];
            if (type === 'TAB') {
                form.tabs.push(newNode as TabNode);
            }
        } else if (parentNode.type === 'TAB' || parentNode.type === 'SECTION') {
            // Add to rows
            if (!parentNode.contents) parentNode.contents = { width: 12, cellWidth: 1, rows: [] };
            if (!parentNode.contents.rows) parentNode.contents.rows = [];

            // Add to last row if space exists, or new row
            const rows = parentNode.contents.rows;
            // const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;

            // Simple logic: Always add to new row for section/tab children to ensure visibility,
            // unless it's a field, where we might want to pack them.
            // For now, let's just append a new row with this item.
            rows.push({ contents: [newNode] });
        }

        setData({ ...data });
    };

    const deleteNode = (nodeToDelete: BaseNode) => {
        // Recursive delete helper
        const deleteFromNode = (current: BaseNode): boolean => {
            if (current.type === 'FORM') {
                const form = current as FormNode;
                if (form.tabs) {
                    const idx = form.tabs.findIndex((n: BaseNode) => n === nodeToDelete || n.id === nodeToDelete.id);
                    if (idx !== -1) {
                        form.tabs.splice(idx, 1);
                        return true;
                    }
                    return form.tabs.some((t: TabNode) => deleteFromNode(t));
                }
            }

            if (current.contents && current.contents.rows) {
                for (let i = 0; i < current.contents.rows.length; i++) {
                    const row = current.contents.rows[i];
                    const idx = row.contents.findIndex((n: BaseNode) => n === nodeToDelete || n.id === nodeToDelete.id);
                    if (idx !== -1) {
                        row.contents.splice(idx, 1);
                        // Remove empty row
                        if (row.contents.length === 0) {
                            current.contents.rows.splice(i, 1);
                        }
                        return true;
                    }
                    // Recurse
                    if (row.contents.some((n: BaseNode) => deleteFromNode(n))) return true;
                }
            }
            return false;
        };

        if (deleteFromNode(data)) {
            setData({ ...data });
            if (selectedNode === nodeToDelete) setSelectedNode(null);
        }
    };

    const moveNode = (activeId: string, overId: string) => {

        type NodeLocation = {
            parent: BaseNode;
            containerType: 'tabs' | 'rows';
            index: number; // Index in tabs array OR Index of Row
            subIndex?: number; // Index inside the row (for 'rows' type)
        };

        const findLocation = (root: BaseNode, id: string): NodeLocation | null => {
            if (root.type === 'FORM') {
                const form = root as FormNode;
                if (form.tabs) {
                    const tabIdx = form.tabs.findIndex(t => t.id === id);
                    if (tabIdx !== -1) return { parent: form, containerType: 'tabs', index: tabIdx };

                    for (const tab of form.tabs) {
                        const res = findLocation(tab, id);
                        if (res) return res;
                    }
                }
            }
            if (root.contents?.rows) {
                for (let r = 0; r < root.contents.rows.length; r++) {
                    const row = root.contents.rows[r];
                    const cIdx = row.contents.findIndex(c => c.id === id);
                    if (cIdx !== -1) {
                        return { parent: root, containerType: 'rows', index: r, subIndex: cIdx };
                    }
                    // Recurse
                    for (const item of row.contents) {
                        const res = findLocation(item, id);
                        if (res) return res;
                    }
                }
            }
            return null;
        };

        const cleanEmptyRows = (node: BaseNode): BaseNode => {
            if (node.contents && node.contents.rows) {
                // First recurse down
                node.contents.rows.forEach(row => {
                    row.contents = row.contents.map(c => cleanEmptyRows(c));
                });

                // Then filter current rows
                const hasEmptyRows = node.contents.rows.some(r => r.contents.length === 0);
                if (hasEmptyRows) {
                    node.contents.rows = node.contents.rows.filter(r => r.contents.length > 0);
                }
            }

            if (node.type === 'FORM') {
                const form = node as FormNode;
                if (form.tabs) {
                    form.tabs = form.tabs.map(t => cleanEmptyRows(t) as import('../types').TabNode);
                }
            }
            return node;
        };

        const activeLoc = findLocation(data, activeId);
        const overLoc = findLocation(data, overId);

        if (!activeLoc || !overLoc) return;

        const activeNode = activeLoc.containerType === 'tabs'
            ? (activeLoc.parent as FormNode).tabs![activeLoc.index]
            : activeLoc.parent.contents!.rows![activeLoc.index].contents[activeLoc.subIndex!];

        const overNode = overLoc.containerType === 'tabs'
            ? (overLoc.parent as FormNode).tabs![overLoc.index]
            : overLoc.parent.contents!.rows![overLoc.index].contents[overLoc.subIndex!];

        // LOGIC 1: Drop INTO Container
        const isContainer = overNode.type === 'TAB' || overNode.type === 'SECTION';
        const isValidChild = (parent: string, child: string) => {
            if (parent === 'TAB' && child === 'SECTION') return true;
            if (parent === 'SECTION' && (child === 'FIELD' || child === 'SUBFORM' || child === 'SECTION')) return true;
            return false;
        };

        if (isContainer && activeNode.type !== overNode.type && isValidChild(overNode.type, activeNode.type)) {
            // Remove active
            if (activeLoc.containerType === 'tabs') {
                (activeLoc.parent as FormNode).tabs!.splice(activeLoc.index, 1);
            } else {
                activeLoc.parent.contents!.rows![activeLoc.index].contents.splice(activeLoc.subIndex!, 1);
            }

            // Add to container
            if (!overNode.contents) overNode.contents = { width: 12, cellWidth: 1, rows: [] };
            if (!overNode.contents.rows) overNode.contents.rows = [];
            overNode.contents.rows.push({ contents: [activeNode] });

            cleanEmptyRows(data);
            setData({ ...data });
            return;
        }

        // LOGIC 2: Reorder

        // Case A: Reordering Tabs
        if (activeLoc.containerType === 'tabs' && overLoc.containerType === 'tabs' && activeLoc.parent === overLoc.parent) {
            const tabs = (activeLoc.parent as FormNode).tabs!;
            const [moved] = tabs.splice(activeLoc.index, 1);
            tabs.splice(overLoc.index, 0, moved);
            setData({ ...data });
            return;
        }

        // Case B: Reordering Row Items (Fields/Sections)
        if (activeLoc.containerType === 'rows' && overLoc.containerType === 'rows') {
            // Remove active from its original row
            const activeRow = activeLoc.parent.contents!.rows![activeLoc.index];
            const [movedNode] = activeRow.contents.splice(activeLoc.subIndex!, 1);

            // Determine target insertion
            const targetParent = overLoc.parent;
            const targetRows = targetParent.contents!.rows!;
            let targetRowIndex = overLoc.index;

            // If we drag down in same parent, we generally want to insert AFTER the target row 
            // to visually displace it upwards.
            // But since we are creating a NEW row, "Insert Before" forces target down.
            // "Insert After" forces target up.

            // Standard reorder behavior:
            // If dragging item A to item B.
            // If B is below A: Insert B's row + 1?

            if (activeLoc.parent === overLoc.parent && activeLoc.index < overLoc.index) {
                targetRowIndex += 1;
            }

            // Insert new row
            targetRows.splice(targetRowIndex, 0, { contents: [movedNode] });

            cleanEmptyRows(data);
            setData({ ...data });
            return;
        }
    };

    // WAITING: I need to add IDs to the `BaseNode` interface and `INITIAL_DATA` first to make this robust.
    return (
        <EditorContext.Provider value={{ data, setData, selectedNode, selectNode: setSelectedNode, updateNode, addNode, deleteNode, moveNode }}>
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
