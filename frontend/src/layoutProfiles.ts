import { type MappingLevel, type MappingProfile } from './types';
import { createId } from './schema';

const PROFILE_STORAGE_KEY = 'jsonEditor.layoutProfiles';
const PROFILE_ACTIVE_KEY = 'jsonEditor.activeProfileId';
const PROFILE_MODE_KEY = 'jsonEditor.layoutMode';

export type LayoutMode = 'auto' | 'profile';

const asObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const loadProfiles = (): MappingProfile[] => {
    try {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const normalized = parsed.map(normalizeProfile).filter(Boolean) as MappingProfile[];
        const seen = new Set<string>();
        return normalized.filter(profile => {
            const key = profile.id || profile.name;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    } catch {
        return [];
    }
};

export const saveProfiles = (profiles: MappingProfile[]) => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
};

export const loadActiveProfileId = (): string | null => {
    return localStorage.getItem(PROFILE_ACTIVE_KEY);
};

export const saveActiveProfileId = (id: string | null) => {
    if (!id) {
        localStorage.removeItem(PROFILE_ACTIVE_KEY);
        return;
    }
    localStorage.setItem(PROFILE_ACTIVE_KEY, id);
};

export const loadLayoutMode = (): LayoutMode => {
    const raw = localStorage.getItem(PROFILE_MODE_KEY);
    return raw === 'profile' ? 'profile' : 'auto';
};

export const saveLayoutMode = (mode: LayoutMode) => {
    localStorage.setItem(PROFILE_MODE_KEY, mode);
};

export const createEmptyProfile = (name: string): MappingProfile => {
    const now = new Date().toISOString();
    return {
        id: createId(),
        name,
        description: '',
        levels: [
            {
                id: createId(),
                name: 'Level 1',
                role: 'field',
                path: '',
                labelKey: 'name',
                filterKey: '',
                filterValues: []
            }
        ],
        fieldAttributes: ['name'],
        createdAt: now,
        updatedAt: now
    };
};

export const createEmptyLevel = (name: string, role: MappingLevel['role'] = 'group'): MappingLevel => ({
    id: createId(),
    name,
    role,
    path: '',
    labelKey: 'name',
    filterKey: '',
    filterValues: []
});

const normalizePathString = (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) return '';
    let fixed = trimmed
        .replace(/\s*\.\s*/g, '.')
        .replace(/\s*\[\s*/g, '[')
        .replace(/\s*\]\s*/g, ']');
    fixed = fixed.replace(/(\])(?=[A-Za-z0-9_])/g, '$1.');
    fixed = fixed.replace(/\.+/g, '.');
    fixed = fixed.replace(/^\.|\.$/g, '');
    return fixed;
};

const normalizeProfile = (raw: any): MappingProfile | null => {
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw.levels)) return null;
    const profileId = typeof raw.id === 'string' ? raw.id : createId();
    const levelIds = new Set<string>();
    const levels = raw.levels.map((level: any, index: number) => {
        const candidateId = typeof level?.id === 'string' ? level.id : createId();
        const id = levelIds.has(candidateId) ? createId() : candidateId;
        levelIds.add(id);
        return {
            id,
            name: typeof level?.name === 'string' ? level.name : `Level ${index + 1}`,
            role: level?.role,
            path: typeof level?.path === 'string' ? normalizePathString(level.path) : '',
            labelKey: typeof level?.labelKey === 'string' ? level.labelKey : 'name',
            filterKey: typeof level?.filterKey === 'string' ? level.filterKey : '',
            filterValues: Array.isArray(level?.filterValues) ? level.filterValues : [],
            overridePaths: Array.isArray(level?.overridePaths) ? level.overridePaths : undefined
        } as MappingLevel;
    });
    return {
        ...raw,
        id: profileId,
        levels,
        createdAt: raw.createdAt ?? new Date().toISOString(),
        updatedAt: raw.updatedAt ?? new Date().toISOString()
    } as MappingProfile;
};

const buildLevel = (name: string, path: string, labelKey: string, filterKey: string, filterValues: string[], overridePaths?: string[], role?: MappingLevel['role']): MappingLevel => ({
    id: createId(),
    name,
    role,
    path,
    labelKey,
    filterKey,
    filterValues,
    overridePaths
});

export const createFormLayoutProfile = (raw: unknown): MappingProfile | null => {
    if (!asObject(raw)) return null;
    if (raw.type !== 'FORM' || !Array.isArray(raw.tabs)) return null;

    const now = new Date().toISOString();
    return {
        id: createId(),
        name: 'Form Layout (Tabs/Sections/Fields)',
        description: 'Levels map tabs → sections → fields for the original form layout JSON.',
        levels: [
            buildLevel('Tabs', 'tabs[*]', 'name', 'type', ['TAB'], undefined, 'tab'),
            buildLevel('Sections', 'contents.rows[*].contents[*]', 'name', 'type', ['SECTION', 'SUBFORM'], undefined, 'group'),
            buildLevel('Fields', 'contents.rows[*].contents[*]', 'name', 'type', ['FIELD'], undefined, 'field')
        ],
        fieldAttributes: ['name', 'width', 'offset', 'type', 'rule'],
        createdAt: now,
        updatedAt: now
    };
};
