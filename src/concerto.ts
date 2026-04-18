import type { ActionType, ConcertoMethod, ConcertoMethodDescriptor, ControlMethod, OperationPlan } from './types.js';

export const CONCERTO_METHODS: readonly ConcertoMethodDescriptor[] = [
  {
    id: 'chrome-extension',
    name: 'Chrome Extension Bridge',
    role: 'connection',
    speed: 'fastest',
    outcome: 'perfect',
    control: 'precise',
    cost: 'free',
  },
  {
    id: 'browser-cdp',
    name: 'Browser CDP',
    role: 'connection',
    speed: 'fast',
    outcome: 'high',
    control: 'precise',
    cost: 'free',
  },
  {
    id: 'electron-cdp',
    name: 'Electron CDP',
    role: 'connection',
    speed: 'fast',
    outcome: 'high',
    control: 'precise',
    cost: 'free',
  },
  {
    id: 'office-com+uia',
    name: 'Office COM + UIA',
    role: 'connection',
    speed: 'fast',
    outcome: 'high',
    control: 'precise',
    cost: 'free',
  },
  {
    id: 'qt-uia',
    name: 'Qt Hook via UIA',
    role: 'connection',
    speed: 'moderate',
    outcome: 'good',
    control: 'precise',
    cost: 'free',
  },
  {
    id: 'gtk-uia',
    name: 'GTK Hook via UIA',
    role: 'connection',
    speed: 'moderate',
    outcome: 'good',
    control: 'precise',
    cost: 'free',
  },
  {
    id: 'java-jab-uia',
    name: 'Java Access Bridge via UIA',
    role: 'connection',
    speed: 'moderate',
    outcome: 'good',
    control: 'precise',
    cost: 'free',
  },
  {
    id: 'flutter-uia',
    name: 'Flutter Hook via UIA',
    role: 'connection',
    speed: 'moderate',
    outcome: 'good',
    control: 'precise',
    cost: 'free',
  },
  {
    id: 'win-uia',
    name: 'Windows UI Automation',
    role: 'connection',
    speed: 'moderate',
    outcome: 'good',
    control: 'precise',
    cost: 'free',
  },
  {
    id: 'direct-api',
    name: 'Direct Application API',
    role: 'connection',
    speed: 'fast',
    outcome: 'high',
    control: 'precise',
    cost: 'free',
  },
  {
    id: 'keyboard-native',
    name: 'Keyboard Native',
    role: 'action',
    speed: 'fastest',
    outcome: 'high',
    control: 'broad',
    cost: 'free',
  },
  {
    id: 'os-input-injection',
    name: 'OS Raw Input Injection',
    role: 'action',
    speed: 'fast',
    outcome: 'perfect',
    control: 'spatial',
    cost: 'free',
  },
  {
    id: 'vision-analysis',
    name: 'Vision Analysis',
    role: 'verification',
    speed: 'slow',
    outcome: 'variable',
    control: 'broad',
    cost: 'api',
  },
  {
    id: 'vision',
    name: 'Vision Fallback',
    role: 'connection',
    speed: 'slow',
    outcome: 'variable',
    control: 'spatial',
    cost: 'api',
  },
] as const;

export function getConcertoMethodInventory(): ConcertoMethodDescriptor[] {
  return [...CONCERTO_METHODS];
}

export function planOperation(
  connectionMethod: ControlMethod,
  action: ActionType | 'describe',
  connectionFallbacks: ControlMethod[] = [],
): OperationPlan {
  if (action === 'keypress' || action === 'hotkey') {
    return {
      action,
      primaryMethod: 'keyboard-native',
      fallbackMethods: [connectionMethod, ...connectionFallbacks.filter(m => m !== connectionMethod)],
      rationale: 'Keyboard commands are fastest and cheapest to dispatch through native input injection.',
    };
  }

  if (action === 'drag' || action === 'scroll') {
    return {
      action,
      primaryMethod: 'os-input-injection',
      fallbackMethods: ['vision', ...connectionFallbacks.filter(m => m !== 'vision')],
      rationale: 'Continuous spatial gestures require OS-level drag and scroll injection for precise control.',
    };
  }

  if (action === 'describe') {
    return {
      action,
      primaryMethod: 'vision-analysis',
      fallbackMethods: ['vision'],
      rationale: 'Visual verification is a screenshot-and-analysis workflow rather than a framework hook operation.',
    };
  }

  if (action === 'screenshot') {
    return {
      action,
      primaryMethod: connectionMethod,
      fallbackMethods: ['vision-analysis', ...connectionFallbacks.filter(m => m !== connectionMethod)],
      rationale: 'Capture uses the active connection first, then falls back to screenshot-based verification when needed.',
    };
  }

  return {
    action,
    primaryMethod: connectionMethod,
    fallbackMethods: connectionFallbacks.filter(m => m !== connectionMethod),
    rationale: 'Use the connected framework or accessibility hook first, then fall back through the registered cascade.',
  };
}
