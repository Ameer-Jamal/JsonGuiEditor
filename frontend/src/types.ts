
export type NodeType = 'FORM' | 'TAB' | 'SECTION' | 'FIELD' | 'SUBFORM';

export interface BaseNode {
    name: string;
    type: NodeType;
    width?: number; // 1-12 usually
    offset?: number;
    id?: string; // Internal ID for drag and drop
    contents?: NodeContainer;
    // Generic key-value for other props
    [key: string]: any;
}

export interface NodeContainer {
    width?: number;
    cellWidth?: number;
    rows?: RowNode[];
}

export interface RowNode {
    contents: BaseNode[];
}

export interface FormNode extends BaseNode {
    type: 'FORM';
    tabs?: TabNode[];
}

export interface TabNode extends BaseNode {
    type: 'TAB';
}

export interface SectionNode extends BaseNode {
    type: 'SECTION';
}

export interface FieldNode extends BaseNode {
    type: 'FIELD';
}

// Helper to check for container vs tab structure (since Tabs array acts like rows in the root)
export function hasRows(node: BaseNode): boolean {
    return !!node.contents?.rows;
}
