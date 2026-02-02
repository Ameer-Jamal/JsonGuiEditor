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
        return parsed.map(normalizeProfile).filter(Boolean) as MappingProfile[];
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
                path: '',
                labelKey: 'name',
                filterKey: '',
                filterValues: []
            },
            {
                id: createId(),
                name: 'Level 2',
                path: '',
                labelKey: 'name',
                filterKey: '',
                filterValues: []
            },
            {
                id: createId(),
                name: 'Level 3',
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

const normalizeProfile = (raw: any): MappingProfile | null => {
    if (!raw || typeof raw !== 'object') return null;
    if (Array.isArray(raw.levels)) {
        return raw as MappingProfile;
    }
    return null;
};

const buildLevel = (name: string, path: string, labelKey: string, filterKey: string, filterValues: string[], overridePaths?: string[]): MappingLevel => ({
    id: createId(),
    name,
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
            buildLevel('Tabs', 'tabs[*]', 'name', 'type', ['TAB']),
            buildLevel('Sections', 'contents.rows[*].contents[*]', 'name', 'type', ['SECTION', 'SUBFORM']),
            buildLevel('Fields', 'contents.rows[*].contents[*]', 'name', 'type', ['FIELD'])
        ],
        fieldAttributes: ['name', 'width', 'offset', 'type', 'rule'],
        createdAt: now,
        updatedAt: now
    };
};
