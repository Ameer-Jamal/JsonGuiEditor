import { describe, expect, it } from 'vitest';
import { addMappedItem, buildMappedTree } from './profileMapping';
import { type MappingProfile } from './types';

const makeProfile = (levels: MappingProfile['levels']): MappingProfile => ({
    id: 'profile-1',
    name: 'Test',
    description: '',
    levels,
    fieldAttributes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
});

describe('buildMappedTree', () => {
    it('maps three levels into a nested tree', () => {
        const data = {
            tabs: [
                {
                    name: 'Tab A',
                    sections: [
                        {
                            name: 'Section 1',
                            fields: [{ name: 'Field X', type: 'FIELD' }]
                        }
                    ]
                }
            ]
        };
        const profile = makeProfile([
            {
                id: 'lvl-1',
                name: 'Tabs',
                path: 'tabs[*]',
                labelKey: 'name'
            },
            {
                id: 'lvl-2',
                name: 'Sections',
                path: 'sections[*]',
                labelKey: 'name'
            },
            {
                id: 'lvl-3',
                name: 'Fields',
                path: 'fields[*]',
                labelKey: 'name'
            }
        ]);

        const mapped = buildMappedTree(profile, data);
        expect(mapped).toHaveLength(1);
        expect(mapped[0].title).toBe('Tab A');
        expect(mapped[0].children).toHaveLength(1);
        expect(mapped[0].children?.[0].title).toBe('Section 1');
        expect(mapped[0].children?.[0].children).toHaveLength(1);
        expect(mapped[0].children?.[0].children?.[0].title).toBe('Field X');
    });

    it('supports a root array path', () => {
        const data = [{ name: 'Alpha' }, { name: 'Beta' }];
        const profile = makeProfile([
            {
                id: 'lvl-1',
                name: 'Items',
                path: '[*]',
                labelKey: 'name'
            }
        ]);

        const mapped = buildMappedTree(profile, data);
        expect(mapped.map(node => node.title)).toEqual(['Alpha', 'Beta']);
    });
});

describe('addMappedItem', () => {
    it('adds a new item to a wildcard array path', () => {
        const profile = makeProfile([
            {
                id: 'lvl-1',
                name: 'Items',
                path: 'items[*]',
                labelKey: 'name',
                filterKey: 'type',
                filterValues: ['ITEM']
            }
        ]);

        const result = addMappedItem({}, [], profile.levels[0]);
        expect(result).not.toBeNull();
        expect(result?.nextRoot).toEqual({
            items: [{ type: 'ITEM', name: 'New Items' }]
        });
    });
});
