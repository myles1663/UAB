/**
 * Universal App Bridge — Unified API Type Definitions
 *
 * Every framework plugin maps its native UI tree into these types,
 * giving agents a single consistent interface to any desktop app.
 *
 * This module is framework-agnostic — it can be imported by
 * ClaudeClaw, Lancelot, or any other AI agent runtime.
 */
export interface UIElement {
    id: string;
    type: ElementType;
    label: string;
    properties: Record<string, unknown>;
    bounds: Bounds;
    children: UIElement[];
    actions: ActionType[];
    visible: boolean;
    enabled: boolean;
    meta?: Record<string, unknown>;
}
export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}
export type ElementType = 'window' | 'button' | 'textfield' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'menu' | 'menuitem' | 'list' | 'listitem' | 'table' | 'tablerow' | 'tablecell' | 'tab' | 'tabpanel' | 'tree' | 'treeitem' | 'slider' | 'progressbar' | 'scrollbar' | 'toolbar' | 'statusbar' | 'dialog' | 'tooltip' | 'image' | 'link' | 'label' | 'heading' | 'separator' | 'container' | 'unknown';
export type ActionType = 'click' | 'doubleclick' | 'rightclick' | 'type' | 'clear' | 'select' | 'scroll' | 'focus' | 'hover' | 'expand' | 'collapse' | 'invoke' | 'check' | 'uncheck' | 'toggle' | 'keypress' | 'hotkey' | 'minimize' | 'maximize' | 'restore' | 'close' | 'move' | 'resize' | 'screenshot' | 'contextmenu' | 'readDocument' | 'readCell' | 'writeCell' | 'readRange' | 'writeRange' | 'getSheets' | 'readFormula' | 'readSlides' | 'readSlideText' | 'readEmails' | 'composeEmail' | 'sendEmail' | 'getCookies' | 'setCookie' | 'deleteCookie' | 'clearCookies' | 'getLocalStorage' | 'setLocalStorage' | 'deleteLocalStorage' | 'clearLocalStorage' | 'getSessionStorage' | 'setSessionStorage' | 'deleteSessionStorage' | 'clearSessionStorage' | 'navigate' | 'goBack' | 'goForward' | 'reload' | 'getTabs' | 'switchTab' | 'closeTab' | 'newTab' | 'executeScript';
export interface ElementSelector {
    type?: ElementType;
    label?: string;
    labelExact?: string;
    labelRegex?: string;
    properties?: Record<string, unknown>;
    visible?: boolean;
    enabled?: boolean;
    maxDepth?: number;
    limit?: number;
}
export interface ActionParams {
    text?: string;
    value?: string;
    direction?: 'up' | 'down' | 'left' | 'right';
    amount?: number;
    method?: string;
    args?: unknown[];
    modifiers?: ('ctrl' | 'shift' | 'alt' | 'meta')[];
    key?: string;
    keys?: string[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    outputPath?: string;
    row?: number;
    col?: number;
    sheet?: string;
    cellRange?: string;
    formula?: string;
    values?: string[][];
    to?: string;
    subject?: string;
    body?: string;
    cc?: string;
    folder?: string;
    count?: number;
    slideIndex?: number;
    url?: string;
    domain?: string;
    path?: string;
    cookieName?: string;
    cookieValue?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    expires?: number;
    storageKey?: string;
    storageValue?: string;
    tabId?: string;
    script?: string;
}
export interface ActionResult {
    success: boolean;
    result?: unknown;
    stateChanges?: UIElement[];
    error?: string;
}
export interface AppState {
    window: {
        title: string;
        size: {
            width: number;
            height: number;
        };
        position: {
            x: number;
            y: number;
        };
        focused: boolean;
    };
    activeElement?: UIElement;
    modals: UIElement[];
    menus: UIElement[];
    clipboard?: string;
}
export type UABEventType = 'elementChanged' | 'treeChanged' | 'stateChanged' | 'dataChanged';
export interface UABEvent {
    type: UABEventType;
    timestamp: number;
    element?: UIElement;
    changes?: Record<string, {
        old: unknown;
        new: unknown;
    }>;
}
export type UABEventCallback = (event: UABEvent) => void;
export interface Subscription {
    id: string;
    event: UABEventType;
    unsubscribe: () => void;
}
export type FrameworkType = 'electron' | 'browser' | 'qt5' | 'qt6' | 'gtk3' | 'gtk4' | 'macos-native' | 'wpf' | 'winui' | 'dotnet' | 'flutter' | 'java-swing' | 'javafx' | 'office' | 'unknown';
export interface DetectedApp {
    pid: number;
    name: string;
    path: string;
    framework: FrameworkType;
    confidence: number;
    connectionInfo?: Record<string, unknown>;
    windowTitle?: string;
}
export interface FrameworkPlugin {
    readonly framework: FrameworkType;
    readonly name: string;
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
export interface PluginConnection {
    readonly app: DetectedApp;
    readonly connected: boolean;
    enumerate(): Promise<UIElement[]>;
    query(selector: ElementSelector): Promise<UIElement[]>;
    act(elementId: string, action: ActionType, params?: ActionParams): Promise<ActionResult>;
    state(): Promise<AppState>;
    subscribe(event: UABEventType, callback: UABEventCallback): Promise<Subscription>;
    disconnect(): Promise<void>;
}
export type ControlMethod = 'direct-api' | 'uab-hook' | 'accessibility' | 'vision';
export interface ControlRoute {
    app: DetectedApp;
    method: ControlMethod;
    connection: PluginConnection;
    fallbacks: ControlMethod[];
}
