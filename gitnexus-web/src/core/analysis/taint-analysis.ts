import { GraphNode, KnowledgeGraph } from '../graph/types';

/**
 * Taint Analysis traces data flow from a source node (e.g., API endpoint) 
 * to potential sinks (e.g., Database, External API).
 */
export const traceDataFlow = (
    graph: KnowledgeGraph,
    startNodeId: string,
    maxHops: number = 10
): { pathNodeIds: Set<string>, pathEdgeIds: Set<string> } => {
    const pathNodeIds = new Set<string>();
    const pathEdgeIds = new Set<string>();

    const visited = new Set<string>();
    const queue: { id: string, depth: number }[] = [{ id: startNodeId, depth: 0 }];

    while (queue.length > 0) {
        const { id, depth } = queue.shift()!;

        if (visited.has(id) || depth >= maxHops) continue;
        visited.add(id);
        pathNodeIds.add(id);

        // Find outgoing relationships (CALLS, USES, etc.)
        const outgoing = graph.relationships.filter(rel => rel.sourceId === id);

        outgoing.forEach(rel => {
            pathEdgeIds.add(rel.id);
            queue.push({ id: rel.targetId, depth: depth + 1 });
        });
    }

    return { pathNodeIds, pathEdgeIds };
};
