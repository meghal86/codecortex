import { GraphNode, KnowledgeGraph, GraphRelationship } from '../graph/types';

export interface SinkMatch {
    type: 'filesystem' | 'database' | 'network' | 'auth' | 'os';
    node: GraphNode;
    path: string[]; // Ordered array of node IDs from startNode to sink
}

const SINK_PATTERNS = {
    filesystem: /write|read|fs|file|unlink|chmod|mkdir|rmdir|copy|move/i,
    database: /query|execute|exec|insert|update|delete|drop|commit|db|sql|mongo|redis/i,
    network: /fetch|request|http|socket|send|post|get|put|axios|curl/i,
    auth: /login|authenticate|authorize|verify|sign|token|password|hash|crypto/i,
    os: /exec|spawn|fork|system|process|env/i
};

/**
 * Taint Analysis traces data flow from a source node (e.g., API endpoint) 
 * to potential sinks (e.g., Database, External API).
 * Now returns exact paths to identified sinks.
 */
export const traceDataFlow = (
    graph: KnowledgeGraph,
    startNodeId: string,
    maxHops: number = 10
): {
    pathNodeIds: Set<string>,
    pathEdgeIds: Set<string>,
    sinks: SinkMatch[]
} => {
    const pathNodeIds = new Set<string>();
    const pathEdgeIds = new Set<string>();
    const sinks: SinkMatch[] = [];

    // Map to keep track of shortest path to each visited node
    const nodePaths = new Map<string, string[]>();
    
    // Queue stores [currentId, depth]
    const queue: { id: string, depth: number }[] = [{ id: startNodeId, depth: 0 }];
    nodePaths.set(startNodeId, [startNodeId]);

    while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        pathNodeIds.add(id);

        const currentPath = nodePaths.get(id)!;

        // Check if current node is a sink
        const n = graph.getNode(id);
        if (n && n.id !== startNodeId) {
            let matchedType: keyof typeof SINK_PATTERNS | null = null;
            const name = n.properties.name || '';
            
            for (const [type, pattern] of Object.entries(SINK_PATTERNS)) {
                if (pattern.test(name)) {
                    matchedType = type as keyof typeof SINK_PATTERNS;
                    break;
                }
            }

            if (matchedType) {
                sinks.push({
                    type: matchedType,
                    node: n,
                    path: currentPath
                });
            }
        }

        if (depth >= maxHops) continue;

        // Find outgoing relationships (CALLS, USES, etc.) — O(1) via adjacency index
        const outgoing = graph.getOutgoing(id);

        for (const rel of outgoing) {
            pathEdgeIds.add(rel.id);
            
            if (!nodePaths.has(rel.targetId)) {
                nodePaths.set(rel.targetId, [...currentPath, rel.targetId]);
                queue.push({ id: rel.targetId, depth: depth + 1 });
            }
        }
    }

    return { pathNodeIds, pathEdgeIds, sinks };
};

