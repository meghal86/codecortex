import { KnowledgeGraph } from '../core/graph/types';

export interface BlastRadiusResult {
    affectedNodeIds: Set<string>;
    riskScore: number;
}

export function calculateBlastRadius(
    graph: KnowledgeGraph,
    changedNodeIds: string[],
    maxDepth: number = 2
): BlastRadiusResult {
    const affected = new Set<string>();
    const queue: { id: string; depth: number }[] = [];

    for (const id of changedNodeIds) {
        if (!affected.has(id)) {
            affected.add(id);
            queue.push({ id, depth: 0 });
        }

        // If the changed node is a File, consider all nodes it CONTAINS as changed
        const fileNode = graph.nodes.find((n) => n.id === id);
        if (fileNode?.label === 'File') {
            const containedEdges = graph.relationships.filter(
                (r) => r.sourceId === id && r.type === 'CONTAINS'
            );
            for (const e of containedEdges) {
                if (!affected.has(e.targetId)) {
                    affected.add(e.targetId);
                    queue.push({ id: e.targetId, depth: 0 });
                }
            }
        }
    }

    const DEPENDENCY_EDGES = new Set([
        'CALLS',
        'IMPORTS',
        'EXTENDS',
        'IMPLEMENTS',
        'USES',
        'OVERRIDES',
    ]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.depth >= maxDepth) continue;

        // Find nodes that depend on the current node (incoming edges)
        // i.e., relationships where targetId === current.id and type is a dependency edge
        const incomingEdges = graph.relationships.filter(
            (r) => r.targetId === current.id && DEPENDENCY_EDGES.has(r.type)
        );

        for (const edge of incomingEdges) {
            if (!affected.has(edge.sourceId)) {
                affected.add(edge.sourceId);
                queue.push({ id: edge.sourceId, depth: current.depth + 1 });
            }
        }
    }

    // Calculate composite risk based on affected nodes
    let totalRisk = 0;
    let maxRisk = 0;

    for (const id of affected) {
        const node = graph.nodes.find((n) => n.id === id);
        if (node) {
            const cs = node.properties.complexityScore || 0;
            const hs = node.properties.hotspotScore || 0;
            const risk = cs * 1.5 + hs * 2.5;
            totalRisk += risk;
            maxRisk = Math.max(maxRisk, risk);
        }
    }

    // A basic risk score summarizing the blast radius
    // Combination of max single-node risk and total volume
    const volumePenalty = Math.min(50, affected.size);
    const riskScore = Math.min(
        100,
        Math.round(maxRisk * 0.7 + totalRisk * 0.1 + volumePenalty)
    );

    return {
        affectedNodeIds: affected,
        riskScore,
    };
}
