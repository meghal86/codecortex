import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { KnowledgeGraph } from '../core/graph/types';

export function generateCodeHealthReport(graph: KnowledgeGraph, projectName: string) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Custom colors and fonts
    const primaryColor: [number, number, number] = [6, 182, 212]; // Cyan 500
    const dangerColor: [number, number, number] = [244, 63, 94]; // Rose 500
    const warningColor: [number, number, number] = [245, 158, 11]; // Amber 500
    const textColor: [number, number, number] = [51, 65, 85]; // Slate 700

    // Title page / Header
    doc.setFontSize(24);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('CodeCortex Architecture Report', 14, 25);

    doc.setFontSize(12);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Project: ${projectName || 'Unknown'}`, 14, 35);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 42);

    // Executive Summary Metrics
    const nodes = graph.nodes;
    const edges = graph.relationships;

    const filesCount = nodes.filter(n => n.label === 'File').length;
    const classesCount = nodes.filter(n => n.label === 'Class').length;
    const functionsCount = nodes.filter(n => n.label === 'Function').length;

    doc.setFontSize(16);
    doc.text('Executive Summary', 14, 55);

    const summaryData = [
        ['Total Semantic Nodes', nodes.length.toString()],
        ['Total Relationships', edges.length.toString()],
        ['Files Analyzed', filesCount.toString()],
        ['Classes Detected', classesCount.toString()],
        ['Functions/Methods', functionsCount.toString()],
        ['Edge Density', ((edges.length / Math.max(1, nodes.length)) || 0).toFixed(2) + ' edges/node']
    ];

    autoTable(doc, {
        startY: 60,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: primaryColor },
        margin: { left: 14, right: 14 }
    });

    // Hotspots Analysis (Top 10)
    const nodesWithScores = nodes.filter(n => n.properties.complexityScore !== undefined || n.properties.hotspotScore !== undefined);

    const topComplex = [...nodesWithScores].sort((a, b) => (b.properties.complexityScore || 0) - (a.properties.complexityScore || 0)).slice(0, 5);
    const topHotspots = [...nodesWithScores].sort((a, b) => (b.properties.hotspotScore || 0) - (a.properties.hotspotScore || 0)).slice(0, 5);

    // Safely get Y after the first table
    let currentY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(16);
    doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
    doc.text('Top 5 Architecture Hotspots (High Traffic/Coupling)', 14, currentY);

    const hotspotData = topHotspots.map(n => [
        n.properties.name || n.id,
        n.label,
        n.properties.hotspotScore?.toString() || '0',
        `In: ${n.properties.inDegree || 0}, Out: ${n.properties.outDegree || 0}`
    ]);

    autoTable(doc, {
        startY: currentY + 5,
        head: [['Component', 'Type', 'Hotspot Score', 'Traffic Context']],
        body: hotspotData,
        theme: 'grid',
        headStyles: { fillColor: dangerColor },
        margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(16);
    doc.setTextColor(warningColor[0], warningColor[1], warningColor[2]);
    doc.text('Top 5 Complex Components (High Cyclomatic Complexity)', 14, currentY);

    const complexData = topComplex.map(n => [
        n.properties.name || n.id,
        n.label,
        n.properties.complexityScore?.toString() || '0'
    ]);

    autoTable(doc, {
        startY: currentY + 5,
        head: [['Component', 'Type', 'Complexity Score']],
        body: complexData,
        theme: 'grid',
        headStyles: { fillColor: warningColor },
        margin: { left: 14, right: 14 }
    });

    // Community / Clustering Distribution
    const communityCounts = new Map<number, number>();
    for (const node of nodes) {
        if (node.properties.community !== undefined) {
            const c = Number(node.properties.community);
            communityCounts.set(c, (communityCounts.get(c) || 0) + 1);
        }
    }

    if (communityCounts.size > 0) {
        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Add page break if needed
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(16);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text('Code Ecosystems (Communities)', 14, currentY);

        const communityData = Array.from(communityCounts.entries())
            .sort((a, b) => b[1] - a[1]) // Sort by size descending
            .map(([id, count]) => [`Community ${id}`, `${count} components`]);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Ecosystem ID', 'Size']],
            body: communityData,
            theme: 'grid',
            headStyles: { fillColor: [139, 92, 246] }, // Violet 500
            margin: { left: 14, right: 14 }
        });
    }

    // Footer
    // @ts-ignore
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(
            `Page ${i} of ${pageCount} | CodeCortex Intelligence`,
            pageWidth / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    // Save the PDF
    const filename = `CodeCortex-Health-Report-${projectName || 'Project'}-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename.replace(/[^a-zA-Z0-9.\-]/g, '_'));
}
