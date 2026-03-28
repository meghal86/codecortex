import { GraphRelationship, KnowledgeGraph } from '../graph/types';

export interface GuardrailRule {
    id: string;
    name: string;
    description: string;
    sourceLabel?: string;
    targetLabel?: string;
    forbiddenType?: string;
    allowedLayers?: string[]; // e.g., ["api", "services", "core"]
}

/**
 * Guardrails Engine enforces architectural constraints on the graph.
 * e.g., "Services should not call UI components directly".
 */
export const runGuardrails = (
    graph: KnowledgeGraph,
    rules: GuardrailRule[]
): number => {
    let violationCount = 0;

    graph.relationships.forEach(rel => {
        const sourceNode = graph.nodes.find(n => n.id === rel.sourceId);
        const targetNode = graph.nodes.find(n => n.id === rel.targetId);

        if (!sourceNode || !targetNode) return;

        rules.forEach(rule => {
            let isViolation = false;
            let reason = '';

            // Layer-based enforcement (if filePath contains layer names)
            if (rule.allowedLayers && sourceNode.properties.filePath && targetNode.properties.filePath) {
                const sourceLayer = rule.allowedLayers.find(l => sourceNode.properties.filePath.includes(l));
                const targetLayer = rule.allowedLayers.find(l => targetNode.properties.filePath.includes(l));

                if (sourceLayer && targetLayer) {
                    const sourceIdx = rule.allowedLayers.indexOf(sourceLayer);
                    const targetIdx = rule.allowedLayers.indexOf(targetLayer);

                    // Strict hierarchy: higher index cannot call lower index
                    if (targetIdx < sourceIdx) {
                        isViolation = true;
                        reason = `Layer Violation: ${sourceLayer} should not depend on ${targetLayer}`;
                    }
                }
            }

            // Label-based enforcement
            if (rule.sourceLabel === sourceNode.label && rule.targetLabel === targetNode.label) {
                if (rule.forbiddenType === rel.type) {
                    isViolation = true;
                    reason = rule.description;
                }
            }

            if (isViolation) {
                rel.violation = true;
                rel.violationReason = reason;
                violationCount++;
            }
        });
    });

    return violationCount;
};
