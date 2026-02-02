
export type SchemaType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'any';

export interface SchemaNode {
    id: string;
    type: SchemaType;
    title?: string;
    enum?: Array<string | number | boolean | null>;
    properties?: Record<string, SchemaNode>;
    propertyOrder?: string[];
    required?: string[];
    items?: SchemaNode;
}

export interface JsonNode {
    id: string;
    type: SchemaType;
    key?: string;
    value?: string | number | boolean | null;
    children?: JsonNode[];
}

export type PathSegment =
    | { kind: 'object'; key: string }
    | { kind: 'array'; index: number };

export interface MappingLevel {
    id: string;
    name: string;
    path: string;
    overridePaths?: string[];
    labelKey?: string;
    filterKey?: string;
    filterValues?: string[];
}

export interface MappingProfile {
    id: string;
    name: string;
    description?: string;
    levels: MappingLevel[];
    fieldAttributes: string[];
    createdAt: string;
    updatedAt: string;
}
