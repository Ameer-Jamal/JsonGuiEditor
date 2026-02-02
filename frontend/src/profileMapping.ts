import { type MappingLevel, type MappingProfile, type PathSegment } from './types';

export interface MappedField {
    id: string;
    label: string;
    path: PathSegment[];
    value: unknown;
}

export interface MappedSection {
    id: string;
    title: string;
    path: PathSegment[];
    fields: MappedField[];
}

export interface MappedTab {
    id: string;
    title: string;
    path: PathSegment[];
    sections: MappedSection[];
}

export interface MappedLayout {
    tabs: MappedTab[];
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
    if (!asObject(value)) return [];
    const nextValue = value[current.key];
    const nextPath = [...basePath, { kind: 'object', key: current.key } as PathSegment];

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

export const buildMappedLayout = (profile: MappingProfile, rootValue: unknown): MappedLayout => {
    const [level1, level2, level3] = profile.levels;
    if (!level1 || !level2 || !level3) return { tabs: [] };

    const level1Items = resolveLevel([{ value: rootValue, path: [] }], level1, rootValue);
    const tabs: MappedTab[] = level1Items.map((tabItem, tabIndex) => {
        const tabLabel = getLabel(tabItem.value, level1.labelKey, `${level1.name} ${tabIndex + 1}`);
        const level2Items = resolveLevel([tabItem], level2, rootValue);
        const sections: MappedSection[] = level2Items.map((sectionItem, sectionIndex) => {
            const sectionLabel = getLabel(sectionItem.value, level2.labelKey, `${level2.name} ${sectionIndex + 1}`);
            const level3Items = resolveLevel([sectionItem], level3, rootValue);
            const fields: MappedField[] = level3Items.map((fieldItem, fieldIndex) => ({
                id: `${tabIndex}-${sectionIndex}-${fieldIndex}`,
                label: getLabel(fieldItem.value, level3.labelKey, `${level3.name} ${fieldIndex + 1}`),
                path: fieldItem.path,
                value: fieldItem.value
            }));
            return { id: `${tabIndex}-${sectionIndex}`, title: sectionLabel, path: sectionItem.path, fields };
        });
        return { id: `tab-${tabIndex}`, title: tabLabel, path: tabItem.path, sections };
    });

    return { tabs };
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
    const clonedRoot = JSON.parse(JSON.stringify(rootValue ?? {}));
    const parentValue = parentPath.length ? getValueAtPath(clonedRoot, parentPath) : clonedRoot;
    if (parentValue === undefined || parentValue === null) return null;

    const tokens = parsePath(level.path);
    if (tokens.length === 0) return null;

    let current: any = parentValue;
    let currentPath: PathSegment[] = [...parentPath];

    tokens.forEach((token, index) => {
        const isLast = index === tokens.length - 1;
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
