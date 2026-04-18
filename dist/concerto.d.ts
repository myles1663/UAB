import type { ActionType, ConcertoMethodDescriptor, ControlMethod, OperationPlan } from './types.js';
export declare const CONCERTO_METHODS: readonly ConcertoMethodDescriptor[];
export declare function getConcertoMethodInventory(): ConcertoMethodDescriptor[];
export declare function planOperation(connectionMethod: ControlMethod, action: ActionType | 'describe', connectionFallbacks?: ControlMethod[]): OperationPlan;
//# sourceMappingURL=concerto.d.ts.map