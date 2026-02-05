import React from 'react';
import { useEditor } from '../context/EditorContext';
import { createSchemaNode, findJsonNodeByPath, findSchemaNodeByPath, jsonTreeToValue } from '../schema';
import { type JsonNode, type SchemaNode } from '../types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { buildMappedTree, type MappedNode } from '../profileMapping';

const PrimitiveField = ({ node, schema }: { node: JsonNode; schema: SchemaNode }) => {
    const { updateNodeValue } = useEditor();
    if (node.type === 'boolean') {
        return (
            <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                    type="checkbox"
                    checked={Boolean(node.value)}
                    onChange={(e) => updateNodeValue(node.id, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                />
                <span>Boolean</span>
            </label>
        );
    }

    if (node.type === 'number') {
        return (
            <input
                type="number"
                value={Number(node.value ?? 0)}
                onChange={(e) => updateNodeValue(node.id, e.target.value)}
                className="input-field w-full"
            />
        );
    }

    if (schema.enum && node.type === 'string') {
        return (
            <select
                value={String(node.value ?? '')}
                onChange={(e) => updateNodeValue(node.id, e.target.value)}
                className="input-field w-full"
            >
                {schema.enum.map(option => (
                    <option key={String(option)} value={String(option)}>
                        {String(option)}
                    </option>
                ))}
            </select>
        );
    }

    if (node.type === 'null') {
        return (
            <div className="text-xs text-slate-400 italic">null</div>
        );
    }

    return (
        <input
            type="text"
            value={String(node.value ?? '')}
            onChange={(e) => updateNodeValue(node.id, e.target.value)}
            className="input-field w-full"
        />
    );
};

const getChildValue = (node: JsonNode, key: string) => {
    if (node.type !== 'object') return undefined;
    const child = node.children?.find(item => item.key === key);
    return child?.value;
};

const isFormLayoutField = (node: JsonNode) => getChildValue(node, 'type') === 'FIELD';

const ProfileFieldCard = ({
    label,
    placeholder,
    width,
    isSelected,
    onSelect
}: {
    label: string;
    placeholder: string;
    width: number;
    isSelected: boolean;
    onSelect: () => void;
}) => (
    <div
        style={{ gridColumn: `span ${width}` }}
        className={clsx(
            "rounded-xl border border-slate-200 bg-white p-3 space-y-2",
            isSelected && "ring-2 ring-blue-500/30 border-blue-400"
        )}
    >
        <div className="text-[11px] text-slate-500 mb-1">{label}</div>
        <input
            type="text"
            className="input-field w-full"
            placeholder={placeholder}
            readOnly
            onClick={(event) => {
                event.stopPropagation();
                onSelect();
            }}
            onFocus={(event) => {
                event.stopPropagation();
                onSelect();
            }}
        />
    </div>
);

const ProfileLeafNode = ({
    node,
    valueTree,
    schema,
    selectNode,
    selectedNode
}: {
    node: MappedNode;
    valueTree: JsonNode;
    schema: SchemaNode;
    selectNode: (node: JsonNode) => void;
    selectedNode: JsonNode | null;
}) => {
    const resolved = findJsonNodeByPath(valueTree, node.path);
    if (!resolved) {
        return (
            <div className="col-span-12 text-[11px] text-red-500">
                Missing node for {node.title || 'field'}
            </div>
        );
    }
    const nodeSchema = findSchemaNodeByPath(schema, node.path) ?? createSchemaNode(resolved.type);
    if (isFormLayoutField(resolved)) {
        const nameValue = getChildValue(resolved, 'name');
        const widthValue = getChildValue(resolved, 'width');
        const fieldWidth = typeof widthValue === 'number' ? widthValue : 12;
        const isSelected = selectedNode?.id === resolved.id;
        return (
            <ProfileFieldCard
                label={String(nameValue ?? node.title ?? 'Field')}
                placeholder={String(nameValue ?? '')}
                width={fieldWidth}
                isSelected={isSelected}
                onSelect={() => selectNode(resolved)}
            />
        );
    }
    return (
        <div className="col-span-12">
            {node.title && resolved.type !== 'object' && resolved.type !== 'array' && (
                <div className="text-[11px] text-slate-500 mb-1">{node.title}</div>
            )}
            <NodeRenderer node={resolved} schema={nodeSchema} />
        </div>
    );
};

const ProfileGroup = ({
    node,
    levelIndex,
    levels,
    valueTree,
    schema,
    selectNode,
    selectedNode
}: {
    node: MappedNode;
    levelIndex: number;
    levels: { name: string }[];
    valueTree: JsonNode;
    schema: SchemaNode;
    selectNode: (node: JsonNode) => void;
    selectedNode: JsonNode | null;
}) => {
    const isLeaf = levelIndex === levels.length - 1;
    if (isLeaf) {
        return (
            <ProfileLeafNode
                node={node}
                valueTree={valueTree}
                schema={schema}
                selectNode={selectNode}
                selectedNode={selectedNode}
            />
        );
    }

    const nextIsLeaf = levelIndex === levels.length - 2;
    return (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 space-y-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {node.title || levels[levelIndex]?.name}
            </div>
            {nextIsLeaf ? (
                <div className="grid grid-cols-12 gap-4">
                    {(node.children ?? []).map(child => (
                        <ProfileLeafNode
                            key={child.id}
                            node={child}
                            valueTree={valueTree}
                            schema={schema}
                            selectNode={selectNode}
                            selectedNode={selectedNode}
                        />
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {(node.children ?? []).map(child => (
                        <ProfileGroup
                            key={child.id}
                            node={child}
                            levelIndex={levelIndex + 1}
                            levels={levels}
                            valueTree={valueTree}
                            schema={schema}
                            selectNode={selectNode}
                            selectedNode={selectedNode}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const ProfileLayout = ({
    nodes,
    activeTabId,
    setActiveTabId,
    valueTree,
    schema,
    selectNode,
    selectedNode,
    levels
}: {
    nodes: MappedNode[];
    activeTabId: string | null;
    setActiveTabId: (id: string) => void;
    valueTree: JsonNode;
    schema: SchemaNode;
    selectNode: (node: JsonNode) => void;
    selectedNode: JsonNode | null;
    levels: { name: string; role?: 'tab' | 'group' | 'field' }[];
}) => {
    if (!nodes.length) return null;
    const useTabs = levels[0]?.role === 'tab' && nodes.length > 1;
    const activeNode = nodes.find(tab => tab.id === activeTabId) ?? nodes[0];

    if (!useTabs) {
        return (
            <div className="space-y-6">
                {nodes.map(node => (
                    <ProfileGroup
                        key={node.id}
                        node={node}
                        levelIndex={0}
                        levels={levels}
                        valueTree={valueTree}
                        schema={schema}
                        selectNode={selectNode}
                        selectedNode={selectedNode}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                {nodes.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                            activeTabId === tab.id
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        )}
                    >
                        {tab.title}
                    </button>
                ))}
            </div>
            {activeNode && levels.length === 1 && (
                <div className="grid grid-cols-12 gap-4">
                    <ProfileLeafNode
                        node={activeNode}
                        valueTree={valueTree}
                        schema={schema}
                        selectNode={selectNode}
                        selectedNode={selectedNode}
                    />
                </div>
            )}
            {activeNode && levels.length > 1 && (
                <div className="space-y-6">
                    {(activeNode.children ?? []).map(child => (
                        <ProfileGroup
                            key={child.id}
                            node={child}
                            levelIndex={1}
                            levels={levels}
                            valueTree={valueTree}
                            schema={schema}
                            selectNode={selectNode}
                            selectedNode={selectedNode}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const NodeRenderer = ({ node, schema, depth = 0 }: { node: JsonNode; schema: SchemaNode; depth?: number }) => {
    const { selectedNode, selectNode } = useEditor();
    const isSelected = selectedNode?.id === node.id;
    const label = node.key ?? (depth === 0 ? 'Root' : '');

    if (node.type === 'object') {
        return (
            <motion.div
                layout
                className={clsx(
                    "rounded-xl border border-slate-200 bg-white/70 shadow-sm p-4 space-y-4",
                    isSelected && "ring-2 ring-blue-500/30 border-blue-400"
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    selectNode(node);
                }}
            >
                {label && <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>}
                <div className="space-y-4">
                    {(node.children ?? []).map(child => (
                        <NodeRenderer
                            key={child.id}
                            node={child}
                            schema={schema.properties?.[child.key ?? ''] ?? createSchemaNode(child.type)}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            </motion.div>
        );
    }

    if (node.type === 'array') {
        return (
            <motion.div
                layout
                className={clsx(
                    "rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 space-y-3",
                    isSelected && "ring-2 ring-blue-500/30 border-blue-400"
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    selectNode(node);
                }}
            >
                {label && <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>}
                {(node.children ?? []).map((child, index) => (
                    <div key={child.id} className="pl-3 border-l border-slate-200">
                        <div className="text-[10px] text-slate-400 mb-2">Item {index + 1}</div>
                        <NodeRenderer
                            node={child}
                            schema={schema.items ?? createSchemaNode(child.type)}
                            depth={depth + 1}
                        />
                    </div>
                ))}
            </motion.div>
        );
    }

    return (
        <motion.div
            layout
            className={clsx(
                "rounded-xl border border-slate-200 bg-white p-3 space-y-2",
                isSelected && "ring-2 ring-blue-500/30 border-blue-400"
            )}
            onClick={(e) => {
                e.stopPropagation();
                selectNode(node);
            }}
        >
            {label && <div className="text-[11px] text-slate-500 uppercase">{label}</div>}
            <PrimitiveField node={node} schema={schema} />
        </motion.div>
    );
};

export const Preview = () => {
    const { valueTree, schema, layoutMode, activeProfile, selectNode, selectedNode } = useEditor();
    const [activeTabId, setActiveTabId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!activeProfile) {
            setActiveTabId(null);
            return;
        }
        const rootValue = jsonTreeToValue(valueTree);
        const mapped = buildMappedTree(activeProfile, rootValue);
        setActiveTabId(mapped[0]?.id ?? null);
    }, [activeProfile, valueTree]);

    return (
        <div className="w-full">
            {layoutMode === 'profile' && activeProfile ? (
                (() => {
                    const mapped = buildMappedTree(activeProfile, jsonTreeToValue(valueTree));
                    return (
                        <ProfileLayout
                            nodes={mapped}
                            activeTabId={activeTabId}
                            setActiveTabId={(id) => setActiveTabId(id)}
                            valueTree={valueTree}
                            schema={schema}
                            selectNode={selectNode}
                            selectedNode={selectedNode}
                            levels={activeProfile.levels}
                        />
                    );
                })()
            ) : (
                <NodeRenderer node={valueTree} schema={schema} />
            )}
        </div>
    );
};
