/**
 * Recursively removes the 'id' property from an object and its nested children.
 * Useful for cleaning internal React IDs before exporting/copying JSON.
 */
export const stripIds = (node: any): any => {
    if (Array.isArray(node)) {
        return node.map(stripIds);
    } else if (node !== null && typeof node === 'object') {
        const newObj: any = {};
        for (const key in node) {
            if (key !== 'id') {
                newObj[key] = stripIds(node[key]);
            }
        }
        return newObj;
    }
    return node;
};
