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
    mergeFieldWithPrevious: (id: string) => void;
    splitFieldToNewRow: (id: string) => void;
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

    const updateNode = (updatedNode: BaseNode) => {
        if (updatedNode.type === 'FORM') {
            setData(updatedNode as FormNode);
            setSelectedNode(updatedNode);
            return;
        }

        const replaceNode = (current: BaseNode, target: BaseNode): BaseNode => {
            if (current.id === target.id) {
                return target;
            }
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

        if (parentNode.type === 'FORM') {
            const form = parentNode as FormNode;
            if (!form.tabs) form.tabs = [];
            if (type === 'TAB') {
                form.tabs.push(newNode as TabNode);
            }
        } else if (parentNode.type === 'TAB' || parentNode.type === 'SECTION') {
            if (!parentNode.contents) parentNode.contents = { width: 12, cellWidth: 1, rows: [] };
            if (!parentNode.contents.rows) parentNode.contents.rows = [];
            const rows = parentNode.contents.rows;
            rows.push({ contents: [newNode] });
        }

        setData({ ...data });
    };

    const deleteNode = (nodeToDelete: BaseNode) => {
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
            if (current.contents?.rows) {
                for (let r = 0; r < current.contents.rows.length; r++) {
                    const row = current.contents.rows[r];
                    const idx = row.contents.findIndex(n => n.id === nodeToDelete.id);
                    if (idx !== -1) {
                        row.contents.splice(idx, 1);
                        if (row.contents.length === 0) {
                            current.contents.rows.splice(r, 1);
                        }
                        return true;
                    }
                    if (row.contents.some(c => deleteFromNode(c))) return true;
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
            index: number;
            subIndex?: number;
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
                node.contents.rows.forEach(row => {
                    row.contents = row.contents.map(c => cleanEmptyRows(c));
                });
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

        const isContainer = overNode.type === 'TAB' || overNode.type === 'SECTION';
        const isValidChild = (parent: string, child: string) => {
            if (parent === 'TAB' && child === 'SECTION') return true;
            if (parent === 'SECTION' && (child === 'FIELD' || child === 'SUBFORM' || child === 'SECTION')) return true;
            return false;
        };

        if (isContainer && activeNode.type !== overNode.type && isValidChild(overNode.type, activeNode.type)) {
            if (activeLoc.containerType === 'tabs') {
                (activeLoc.parent as FormNode).tabs!.splice(activeLoc.index, 1);
            } else {
                activeLoc.parent.contents!.rows![activeLoc.index].contents.splice(activeLoc.subIndex!, 1);
            }

            if (!overNode.contents) overNode.contents = { width: 12, cellWidth: 1, rows: [] };
            if (!overNode.contents.rows) overNode.contents.rows = [];
            overNode.contents.rows.push({ contents: [activeNode] });

            cleanEmptyRows(data);
            setData({ ...data });
            return;
        }

        if (activeLoc.containerType === 'tabs' && overLoc.containerType === 'tabs' && activeLoc.parent === overLoc.parent) {
            const tabs = (activeLoc.parent as FormNode).tabs!;
            const [moved] = tabs.splice(activeLoc.index, 1);
            tabs.splice(overLoc.index, 0, moved);
            setData({ ...data });
            return;
        }

        if (activeLoc.containerType === 'rows' && overLoc.containerType === 'rows') {
            const activeRow = activeLoc.parent.contents!.rows![activeLoc.index];
            const [movedNode] = activeRow.contents.splice(activeLoc.subIndex!, 1);

            const targetParent = overLoc.parent;
            const targetRows = targetParent.contents!.rows!;
            let targetRowIndex = overLoc.index;

            if (activeLoc.parent === overLoc.parent && activeLoc.index < overLoc.index) {
                targetRowIndex += 1;
            }

            targetRows.splice(targetRowIndex, 0, { contents: [movedNode] });

            cleanEmptyRows(data);
            setData({ ...data });
            return;
        }
    };

    const mergeFieldWithPrevious = (id: string) => {
        const findAndMerge = (node: BaseNode): boolean => {
            if (node.contents?.rows) {
                for (let r = 0; r < node.contents.rows.length; r++) {
                    const row = node.contents.rows[r];
                    const itemIdx = row.contents.findIndex(c => c.id === id);
                    if (itemIdx !== -1) {
                        if (r > 0) {
                            const prevRow = node.contents.rows[r - 1];
                            const item = row.contents[itemIdx];
                            row.contents.splice(itemIdx, 1);
                            prevRow.contents.push(item);
                            if (row.contents.length === 0) {
                                node.contents.rows.splice(r, 1);
                            }
                            setData({ ...data });
                            return true;
                        }
                        return true;
                    }
                    if (row.contents.some(c => findAndMerge(c))) return true;
                }
            }
            if (node.type === 'FORM') {
                return (node as FormNode).tabs?.some(t => findAndMerge(t)) ?? false;
            }
            return false;
        };
        findAndMerge(data);
    };

    const splitFieldToNewRow = (id: string) => {
        const findAndSplit = (node: BaseNode): boolean => {
            if (node.contents?.rows) {
                for (let r = 0; r < node.contents.rows.length; r++) {
                    const row = node.contents.rows[r];
                    const itemIdx = row.contents.findIndex(c => c.id === id);
                    if (itemIdx !== -1) {
                        if (row.contents.length > 1) {
                            const item = row.contents[itemIdx];
                            row.contents.splice(itemIdx, 1);
                            const newRow: import('../types').RowNode = { contents: [item] };
                            node.contents.rows.splice(r + 1, 0, newRow);
                            setData({ ...data });
                        }
                        return true;
                    }
                    if (row.contents.some(c => findAndSplit(c))) return true;
                }
            }
            if (node.type === 'FORM') {
                return (node as FormNode).tabs?.some(t => findAndSplit(t)) ?? false;
            }
            return false;
        };
        findAndSplit(data);
    };

    return (
        <EditorContext.Provider value={{
            data, setData, selectedNode, selectNode: setSelectedNode,
            updateNode, addNode, deleteNode, moveNode,
            mergeFieldWithPrevious, splitFieldToNewRow
        }}>
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
