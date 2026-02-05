import { type MappingLevel, type MappingProfile, type PathSegment } from './types';

export interface MappedNode {
    id: string;
    title: string;
    path: PathSegment[];
    value: unknown;
    children?: MappedNode[];
}

type PathToken = {
    key: string;
    index?: number | '*';
};

const asObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const parsePath = (path: string): PathToken[] => {
    if (!path.trim()) return [];
    return path.split('.').map(segment => {
        const arrayOnlyMatch = segment.match(/^\[(\*|\d+)\]$/);
        if (arrayOnlyMatch) {
            const indexRaw = arrayOnlyMatch[1];
            return { key: '', index: indexRaw === '*' ? '*' : Number(indexRaw) };
        }
        const match = segment.match(/^([^[\]]+)(?:\[(\*|\d+)\])?$/);
        if (!match) return { key: segment };
        const key = match[1];
        const indexRaw = match[2];
        let index: number | '*' | undefined;
        if (indexRaw === '*') index = '*';
        if (indexRaw && indexRaw !== '*') index = Number(indexRaw);
        return { key, index };
    });
};

const resolveTokens = (
    value: unknown,
    basePath: PathSegment[],
    tokens: PathToken[]
): Array<{ value: unknown; path: PathSegment[] }> => {
    if (!tokens.length) return [{ value, path: basePath }];

    const [current, ...rest] = tokens;
    const hasObjectKey = Boolean(current.key);
    if (hasObjectKey && !asObject(value)) return [];
    const nextValue = hasObjectKey ? (value as Record<string, unknown>)[current.key] : value;
    const nextPath = hasObjectKey
        ? [...basePath, { kind: 'object', key: current.key } as PathSegment]
        : basePath;

    if (current.index === undefined) {
        return resolveTokens(nextValue, nextPath, rest);
    }

    if (!Array.isArray(nextValue)) return [];
    if (current.index === '*') {
        return nextValue.flatMap((item, idx) =>
            resolveTokens(item, [...nextPath, { kind: 'array', index: idx }], rest)
        );
    }
    const item = nextValue[current.index];
    if (item === undefined) return [];
    return resolveTokens(item, [...nextPath, { kind: 'array', index: current.index }], rest);
};

const resolvePath = (root: unknown, basePath: PathSegment[], path: string) =>
    resolveTokens(root, basePath, parsePath(path));

const matchesFilter = (value: unknown, level: MappingLevel): boolean => {
    if (!level.filterKey || !level.filterValues || level.filterValues.length === 0) return true;
    if (!asObject(value)) return false;
    const actual = value[level.filterKey];
    return level.filterValues.includes(String(actual));
};

const getLabel = (value: unknown, labelKey?: string, fallback?: string) => {
    if (!labelKey || !asObject(value)) return fallback ?? 'Untitled';
    const labelValue = value[labelKey];
    if (labelValue === undefined || labelValue === null) return fallback ?? 'Untitled';
    return String(labelValue);
};

const resolveLevel = (
    parents: Array<{ value: unknown; path: PathSegment[] }>,
    level: MappingLevel,
    rootValue: unknown
) => {
    const paths = [level.path, ...(level.overridePaths ?? [])].filter(Boolean);
    return parents.flatMap(parent => {
        if (paths.length === 0) return [];
        return paths.flatMap(path => resolvePath(parent.value ?? rootValue, parent.path, path))
            .filter(match => matchesFilter(match.value, level));
    });
};

const buildNodeId = (levelIndex: number, path: PathSegment[], index: number) => {
    const key = path
        .map(segment => (segment.kind === 'object' ? segment.key : `[${segment.index}]`))
        .join('.');
    return `${levelIndex}-${key || 'root'}-${index}`;
};

export const buildMappedTree = (profile: MappingProfile, rootValue: unknown): MappedNode[] => {
    if (!profile.levels.length) return [];

    const buildLevelNodes = (
        parents: Array<{ value: unknown; path: PathSegment[] }>,
        levelIndex: number
    ): MappedNode[] => {
        const level = profile.levels[levelIndex];
        if (!level) return [];
        const items = resolveLevel(parents, level, rootValue);
        return items.map((item, index) => {
            const title = getLabel(item.value, level.labelKey, `${level.name} ${index + 1}`);
            const isLeaf = levelIndex === profile.levels.length - 1;
            const children = isLeaf ? undefined : buildLevelNodes([item], levelIndex + 1);
            return {
                id: buildNodeId(levelIndex, item.path, index),
                title,
                path: item.path,
                value: item.value,
                children
            };
        });
    };

    return buildLevelNodes([{ value: rootValue, path: [] }], 0);
};

const getValueAtPath = (root: any, path: PathSegment[]) => {
    let current = root;
    for (const segment of path) {
        if (segment.kind === 'object') {
            if (!asObject(current)) return undefined;
            current = current[segment.key];
        } else {
            if (!Array.isArray(current)) return undefined;
            current = current[segment.index];
        }
    }
    return current;
};

const ensureObject = (value: any) => (asObject(value) ? value : {});

const buildNewItem = (level: MappingLevel) => {
    const item: Record<string, unknown> = {};
    if (level.filterKey && level.filterValues && level.filterValues.length > 0) {
        item[level.filterKey] = level.filterValues[0];
    }
    if (level.labelKey) {
        item[level.labelKey] = `New ${level.name}`;
    }
    return item;
};

export const addMappedItem = (
    rootValue: unknown,
    parentPath: PathSegment[],
    level: MappingLevel
): { nextRoot: unknown; newPath: PathSegment[] } | null => {
    let clonedRoot = JSON.parse(JSON.stringify(rootValue ?? {}));
    let parentValue = parentPath.length ? getValueAtPath(clonedRoot, parentPath) : clonedRoot;
    if (parentValue === undefined || parentValue === null) return null;

    const tokens = parsePath(level.path);
    if (tokens.length === 0) return null;

    let current: any = parentValue;
    let currentPath: PathSegment[] = [...parentPath];

    tokens.forEach((token, index) => {
        const isLast = index === tokens.length - 1;
        if (!token.key) {
            if (!Array.isArray(current)) {
                if (parentPath.length === 0 && current === clonedRoot) {
                    clonedRoot = [];
                    parentValue = clonedRoot;
                    current = clonedRoot;
                } else {
                    return;
                }
            }
            const arrayValue = current as any[];
            if (token.index === '*') {
                if (isLast) {
                    const newItem = buildNewItem(level);
                    arrayValue.push(newItem);
                    const newIndex = arrayValue.length - 1;
                    currentPath = [...currentPath, { kind: 'array', index: newIndex }];
                    current = newItem;
                    return;
                }
                const newContainer: Record<string, unknown> = {};
                arrayValue.push(newContainer);
                const newIndex = arrayValue.length - 1;
                currentPath = [...currentPath, { kind: 'array', index: newIndex }];
                current = newContainer;
                return;
            }
            const targetIndex = typeof token.index === 'number' ? token.index : 0;
            while (arrayValue.length <= targetIndex) {
                arrayValue.push({});
            }
            currentPath = [...currentPath, { kind: 'array', index: targetIndex }];
            current = arrayValue[targetIndex];
            return;
        }
        if (!asObject(current)) {
            current = ensureObject(current);
        }

        const keyValue = (current as Record<string, unknown>)[token.key];
        if (token.index === undefined) {
            const nextValue = ensureObject(keyValue);
            (current as Record<string, unknown>)[token.key] = nextValue;
            current = nextValue;
            currentPath = [...currentPath, { kind: 'object', key: token.key }];
            return;
        }

        let arrayValue = Array.isArray(keyValue) ? keyValue : [];
        (current as Record<string, unknown>)[token.key] = arrayValue;
        currentPath = [...currentPath, { kind: 'object', key: token.key }];

        if (token.index === '*') {
            if (isLast) {
                const newItem = buildNewItem(level);
                arrayValue.push(newItem);
                const newIndex = arrayValue.length - 1;
                currentPath = [...currentPath, { kind: 'array', index: newIndex }];
                current = newItem;
                return;
            }
            const newContainer: Record<string, unknown> = {};
            arrayValue.push(newContainer);
            const newIndex = arrayValue.length - 1;
            currentPath = [...currentPath, { kind: 'array', index: newIndex }];
            current = newContainer;
            return;
        }

        const targetIndex = typeof token.index === 'number' ? token.index : 0;
        while (arrayValue.length <= targetIndex) {
            arrayValue.push({});
        }
        currentPath = [...currentPath, { kind: 'array', index: targetIndex }];
        current = arrayValue[targetIndex];
    });

    return { nextRoot: clonedRoot, newPath: currentPath };
};
