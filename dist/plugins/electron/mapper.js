/**
 * DOM-to-UIElement Mapper
 *
 * Translates Chrome DevTools Protocol DOM nodes into the
 * UAB Unified API UIElement format.
 */
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const TAG_TO_TYPE = {
    button: 'button', a: 'link', input: 'textfield', textarea: 'textarea',
    select: 'select', option: 'listitem',
    div: 'container', span: 'label', p: 'label',
    section: 'container', article: 'container', main: 'container',
    aside: 'container', nav: 'container', header: 'container', footer: 'container',
    h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
    table: 'table', tr: 'tablerow', td: 'tablecell', th: 'tablecell',
    ul: 'list', ol: 'list', li: 'listitem',
    img: 'image', menu: 'menu', menuitem: 'menuitem',
    label: 'label', fieldset: 'container', form: 'container',
    hr: 'separator', dialog: 'dialog', progress: 'progressbar',
};
const INPUT_TYPE_MAP = {
    text: 'textfield', password: 'textfield', email: 'textfield',
    number: 'textfield', search: 'textfield', url: 'textfield', tel: 'textfield',
    checkbox: 'checkbox', radio: 'radio',
    submit: 'button', reset: 'button', button: 'button',
    range: 'slider', file: 'button',
};
const ROLE_TO_TYPE = {
    button: 'button', link: 'link', textbox: 'textfield',
    checkbox: 'checkbox', radio: 'radio', combobox: 'select',
    listbox: 'list', option: 'listitem',
    menu: 'menu', menuitem: 'menuitem', menubar: 'menu',
    tab: 'tab', tabpanel: 'tabpanel', tablist: 'container',
    tree: 'tree', treeitem: 'treeitem',
    dialog: 'dialog', alertdialog: 'dialog',
    toolbar: 'toolbar', progressbar: 'progressbar',
    slider: 'slider', scrollbar: 'scrollbar',
    separator: 'separator', img: 'image', heading: 'heading',
    status: 'statusbar', tooltip: 'tooltip',
    grid: 'table', row: 'tablerow', gridcell: 'tablecell', cell: 'tablecell',
};
export class DOMMapper {
    cdp;
    nodeIdMap = new Map();
    constructor(cdp) {
        this.cdp = cdp;
    }
    async mapDocument() {
        this.nodeIdMap.clear();
        const doc = await this.cdp.getDocument(-1);
        const root = doc.root;
        if (!root)
            return [];
        return this.mapChildren(root);
    }
    async mapNode(nodeId) {
        try {
            const result = await this.cdp.send('DOM.describeNode', { nodeId, depth: -1 });
            const node = result.node;
            if (!node)
                return null;
            node.nodeId = nodeId;
            return this.nodeToElement(node);
        }
        catch {
            return null;
        }
    }
    getNodeId(elementId) {
        return this.nodeIdMap.get(elementId);
    }
    mapChildren(parentNode) {
        const elements = [];
        const children = parentNode.children || [];
        for (const child of children) {
            if (child.nodeType === ELEMENT_NODE) {
                const element = this.nodeToElement(child);
                if (element)
                    elements.push(element);
            }
        }
        return elements;
    }
    nodeToElement(node) {
        if (node.nodeType !== ELEMENT_NODE)
            return null;
        const tag = node.localName?.toLowerCase() || node.nodeName?.toLowerCase();
        if (!tag)
            return null;
        if (['script', 'style', 'meta', 'link', 'head', 'noscript', 'br'].includes(tag))
            return null;
        const attrs = this.parseAttributes(node.attributes || []);
        const id = `node-${node.nodeId}`;
        this.nodeIdMap.set(id, node.nodeId);
        const type = this.resolveType(tag, attrs);
        const label = this.resolveLabel(node, attrs);
        const actions = this.resolveActions(type, tag, attrs);
        const properties = { tag, ...attrs };
        const children = this.mapChildren(node);
        if (type === 'container' && children.length === 0 && !label && !attrs['role'] && !attrs['onclick'] && !attrs['tabindex']) {
            const hasText = (node.children || []).some(c => c.nodeType === TEXT_NODE && c.nodeValue?.trim());
            if (!hasText)
                return null;
        }
        return {
            id, type, label, properties,
            bounds: { x: 0, y: 0, width: 0, height: 0 },
            children, actions,
            visible: !attrs['hidden'] && attrs['style']?.includes('display: none') !== true,
            enabled: attrs['disabled'] === undefined,
            meta: { nodeId: node.nodeId, backendNodeId: node.backendNodeId },
        };
    }
    parseAttributes(attrArray) {
        const attrs = {};
        for (let i = 0; i < attrArray.length; i += 2) {
            attrs[attrArray[i]] = attrArray[i + 1] || '';
        }
        return attrs;
    }
    resolveType(tag, attrs) {
        const role = attrs['role'];
        if (role && ROLE_TO_TYPE[role])
            return ROLE_TO_TYPE[role];
        if (tag === 'input') {
            const inputType = (attrs['type'] || 'text').toLowerCase();
            return INPUT_TYPE_MAP[inputType] || 'textfield';
        }
        return TAG_TO_TYPE[tag] || 'container';
    }
    resolveLabel(node, attrs) {
        if (attrs['aria-label'])
            return attrs['aria-label'];
        if (attrs['title'])
            return attrs['title'];
        if (attrs['alt'])
            return attrs['alt'];
        if (attrs['placeholder'])
            return attrs['placeholder'];
        if (attrs['value'] && ['submit', 'reset', 'button'].includes(attrs['type']))
            return attrs['value'];
        const textChildren = (node.children || []).filter(c => c.nodeType === TEXT_NODE);
        const text = textChildren.map(c => c.nodeValue?.trim()).filter(Boolean).join(' ');
        if (text)
            return text.substring(0, 200);
        return '';
    }
    resolveActions(type, tag, attrs) {
        const actions = [];
        if (['button', 'link', 'menuitem', 'tab', 'listitem', 'treeitem', 'checkbox', 'radio'].includes(type)) {
            actions.push('click');
        }
        if (attrs['onclick'] || attrs['tabindex']) {
            if (!actions.includes('click'))
                actions.push('click');
        }
        if (['textfield', 'textarea', 'select', 'button', 'link'].includes(type) || attrs['tabindex']) {
            actions.push('focus');
        }
        if (['textfield', 'textarea'].includes(type)) {
            actions.push('type', 'clear');
        }
        if (type === 'select')
            actions.push('select');
        if (type === 'checkbox')
            actions.push('check', 'uncheck', 'toggle');
        if (type === 'radio')
            actions.push('check');
        if (attrs['aria-expanded'] !== undefined)
            actions.push('expand', 'collapse');
        if (attrs['style']?.includes('overflow') || tag === 'div')
            actions.push('scroll');
        actions.push('hover');
        return actions;
    }
    async populateBounds(element) {
        const nodeId = this.nodeIdMap.get(element.id);
        if (!nodeId)
            return;
        const boxModel = await this.cdp.getBoxModel(nodeId);
        if (boxModel && boxModel.model) {
            const content = boxModel.model.content;
            if (content && content.length >= 8) {
                element.bounds = {
                    x: content[0],
                    y: content[1],
                    width: content[2] - content[0],
                    height: content[5] - content[1],
                };
            }
        }
    }
}
//# sourceMappingURL=mapper.js.map