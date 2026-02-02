import { type JsonNode, type PathSegment, type SchemaNode, type SchemaType } from './types';

export const createId = () => Math.random().toString(36).substring(2, 9);

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const inferType = (value: unknown): SchemaType => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (isObject(value)) return 'object';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'any';
};

export const cloneSchemaNode = (node: SchemaNode): SchemaNode => ({
    ...node,
    enum: node.enum ? [...node.enum] : undefined,
    propertyOrder: node.propertyOrder ? [...node.propertyOrder] : undefined,
    required: node.required ? [...node.required] : undefined,
    properties: node.properties
        ? Object.fromEntries(Object.entries(node.properties).map(([key, child]) => [key, cloneSchemaNode(child)]))
        : undefined,
    items: node.items ? cloneSchemaNode(node.items) : undefined
});

export const cloneJsonNode = (node: JsonNode): JsonNode => ({
    ...node,
    value: node.value,
    children: node.children ? node.children.map(cloneJsonNode) : undefined
});

export const createSchemaNode = (type: SchemaType): SchemaNode => {
    const base: SchemaNode = { id: createId(), type };
    if (type === 'object') {
        base.properties = {};
        base.propertyOrder = [];
        base.required = [];
    }
    if (type === 'array') {
        base.items = createSchemaNode('any');
    }
    return base;
};

export const createJsonNode = (type: SchemaType, key?: string): JsonNode => {
    if (type === 'object') {
        return { id: createId(), type, key, children: [] };
    }
    if (type === 'array') {
        return { id: createId(), type, key, children: [] };
    }
    return { id: createId(), type, key, value: createDefaultValue(type) };
};

export const createDefaultValue = (type: SchemaType): any => {
    switch (type) {
        case 'string':
            return '';
        case 'number':
            return 0;
        case 'boolean':
            return false;
        case 'null':
            return null;
        case 'object':
            return {};
        case 'array':
            return [];
        case 'any':
        default:
            return '';
    }
};

export const coerceValueForType = (value: unknown, type: SchemaType): any => {
    switch (type) {
        case 'string': {
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        }
        case 'number': {
            const num = typeof value === 'number' ? value : Number(value);
            return Number.isFinite(num) ? num : 0;
        }
        case 'boolean':
            if (value === 'true') return true;
            if (value === 'false') return false;
            return Boolean(value);
        case 'null':
            return null;
        case 'object':
            return isObject(value) ? value : {};
        case 'array':
            return Array.isArray(value) ? value : [];
        case 'any':
        default:
            return value;
    }
};

export const buildJsonTree = (value: unknown, key?: string): JsonNode => {
    const type = inferType(value);
    if (type === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        return {
            id: createId(),
            type,
            key,
            children: entries.map(([childKey, childValue]) => buildJsonTree(childValue, childKey))
        };
    }
    if (type === 'array') {
        return {
            id: createId(),
            type,
            key,
            children: (value as unknown[]).map(item => buildJsonTree(item))
        };
    }
    return {
        id: createId(),
        type,
        key,
        value: value as string | number | boolean | null
    };
};

export const jsonTreeToValue = (node: JsonNode): any => {
    switch (node.type) {
        case 'object': {
            const result: Record<string, unknown> = {};
            node.children?.forEach(child => {
                if (child.key) {
                    result[child.key] = jsonTreeToValue(child);
                }
            });
            return result;
        }
        case 'array':
            return node.children?.map(jsonTreeToValue) ?? [];
        case 'string':
        case 'number':
        case 'boolean':
        case 'null':
        case 'any':
        default:
            return node.value ?? createDefaultValue(node.type);
    }
};

const mergeSchemas = (left: SchemaNode, right: SchemaNode): SchemaNode => {
    if (left.type !== right.type) {
        return createSchemaNode('any');
    }
    if (left.type === 'object') {
        const merged = createSchemaNode('object');
        const properties: Record<string, SchemaNode> = {};
        const propertyOrder: string[] = [];

        const leftOrder = left.propertyOrder ?? [];
        const rightOrder = right.propertyOrder ?? [];
        const keys = Array.from(new Set([...leftOrder, ...rightOrder, ...Object.keys(left.properties ?? {}), ...Object.keys(right.properties ?? {})]));

        keys.forEach(key => {
            const leftProp = left.properties?.[key];
            const rightProp = right.properties?.[key];
            if (leftProp && rightProp) {
                properties[key] = mergeSchemas(leftProp, rightProp);
            } else if (leftProp) {
                properties[key] = cloneSchemaNode(leftProp);
            } else if (rightProp) {
                properties[key] = cloneSchemaNode(rightProp);
            }
            if (!propertyOrder.includes(key)) {
                propertyOrder.push(key);
            }
        });

        merged.properties = properties;
        merged.propertyOrder = propertyOrder;
        const leftReq = new Set(left.required ?? []);
        const rightReq = new Set(right.required ?? []);
        merged.required = propertyOrder.filter(key => leftReq.has(key) && rightReq.has(key));
        return merged;
    }
    if (left.type === 'array') {
        const merged = createSchemaNode('array');
        if (left.items && right.items) {
            merged.items = mergeSchemas(left.items, right.items);
        } else if (left.items) {
            merged.items = cloneSchemaNode(left.items);
        } else if (right.items) {
            merged.items = cloneSchemaNode(right.items);
        } else {
            merged.items = createSchemaNode('any');
        }
        return merged;
    }
    return cloneSchemaNode(left);
};

export const inferSchemaFromJson = (value: unknown): SchemaNode => {
    const type = inferType(value);
    if (type === 'object') {
        const node = createSchemaNode('object');
        const entries = Object.entries(value as Record<string, unknown>);
        node.properties = {};
        node.propertyOrder = [];
        node.required = [];
        entries.forEach(([key, childValue]) => {
            node.properties![key] = inferSchemaFromJson(childValue);
            node.propertyOrder!.push(key);
            node.required!.push(key);
        });
        return node;
    }
    if (type === 'array') {
        const items = (value as unknown[]).map(inferSchemaFromJson);
        const node = createSchemaNode('array');
        if (items.length === 0) {
            node.items = createSchemaNode('any');
        } else {
            const [first, ...rest] = items;
            node.items = rest.reduce((acc, item) => mergeSchemas(acc, item), first);
        }
        return node;
    }
    return createSchemaNode(type);
};

export const updateJsonNodeType = (node: JsonNode, type: SchemaType): JsonNode => {
    if (type === 'object') {
        return { ...node, type, value: undefined, children: [] };
    }
    if (type === 'array') {
        return { ...node, type, value: undefined, children: [] };
    }
    return {
        ...node,
        type,
        children: undefined,
        value: coerceValueForType(node.value, type)
    };
};

export const findJsonNodeById = (
    root: JsonNode,
    id: string
): { node: JsonNode; parent: JsonNode | null; path: PathSegment[]; index: number | null } | null => {
    const walk = (node: JsonNode, parent: JsonNode | null, path: PathSegment[]): ReturnType<typeof findJsonNodeById> => {
        if (node.id === id) {
            return { node, parent, path, index: parent?.children ? parent.children.indexOf(node) : null };
        }
        if (node.children) {
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                let segment: PathSegment | null = null;
                if (node.type === 'object' && child.key) {
                    segment = { kind: 'object', key: child.key };
                } else if (node.type === 'array') {
                    segment = { kind: 'array', index: i };
                }
                const nextPath = segment ? [...path, segment] : [...path];
                const found = walk(child, node, nextPath);
                if (found) return found;
            }
        }
        return null;
    };
    return walk(root, null, []);
};

export const findJsonNodeByPath = (root: JsonNode, path: PathSegment[]): JsonNode | null => {
    let current: JsonNode | undefined = root;
    for (const segment of path) {
        if (!current) return null;
        if (segment.kind === 'object') {
            current = current.children?.find(child => child.key === segment.key);
        } else {
            current = current.children?.[segment.index];
        }
    }
    return current ?? null;
};

export const findSchemaNodeByPath = (root: SchemaNode, path: PathSegment[]): SchemaNode | null => {
    let current: SchemaNode | undefined = root;
    for (const segment of path) {
        if (!current) return null;
        if (segment.kind === 'object') {
            current = current.properties?.[segment.key];
        } else {
            current = current.items;
        }
    }
    return current ?? null;
};
