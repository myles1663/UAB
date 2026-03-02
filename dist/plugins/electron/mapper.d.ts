/**
 * DOM-to-UIElement Mapper
 *
 * Translates Chrome DevTools Protocol DOM nodes into the
 * UAB Unified API UIElement format.
 */
import type { UIElement } from '../../types.js';
import type { CDPConnection } from './cdp.js';
export declare class DOMMapper {
    private cdp;
    private nodeIdMap;
    constructor(cdp: CDPConnection);
    mapDocument(): Promise<UIElement[]>;
    mapNode(nodeId: number): Promise<UIElement | null>;
    getNodeId(elementId: string): number | undefined;
    private mapChildren;
    private nodeToElement;
    private parseAttributes;
    private resolveType;
    private resolveLabel;
    private resolveActions;
    populateBounds(element: UIElement): Promise<void>;
}
