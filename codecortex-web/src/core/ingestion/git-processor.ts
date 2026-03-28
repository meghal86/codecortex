import { GitCommit } from '../../hooks/useAppState';

/**
 * Mock Git processor to simulate commit history for the Time-Machine feature.
 * In a real-world scenario, this would fetch data from a Git provider or local .git folder.
 */
export const getMockCommits = (projectName: string): GitCommit[] => {
    const now = new Date();

    return [
        {
            id: 'c1',
            hash: 'a1b2c3d',
            author: 'Meghal Parikh',
            date: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
            message: 'feat: initial architecture setup',
        },
        {
            id: 'c2',
            hash: 'e5f6g7h',
            author: 'Meghal Parikh',
            date: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
            message: 'refactor: decouple ingestion pipeline',
        },
        {
            id: 'c3',
            hash: 'i9j0k1l',
            author: 'Meghal Parikh',
            date: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
            message: 'fix: performance bottlenecks in graph rendering',
        },
        {
            id: 'c4',
            hash: 'm2n3o4p',
            author: 'Meghal Parikh',
            date: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 1).toISOString(), // 1 day ago
            message: 'perf: optimize tree-sitter parsing',
        },
        {
            id: 'c5',
            hash: 'q5r6s7t',
            author: 'Meghal Parikh',
            date: now.toISOString(),
            message: 'feat(processes): Phase 5 - Enhanced Process Discovery',
        },
    ];
};
