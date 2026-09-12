import { findUncoveredRequirements } from '../src/pipeline/coverage';
import { Requirement, Question } from '../src/types/kit';

describe('Deterministic Coverage Checker', () => {
  it('identifies covered and uncovered requirements accurately', () => {
    const reqs: Requirement[] = [
      { id: 'r1', text: 'React', kind: 'technical', priority: 'must' },
      { id: 'r2', text: 'Docker', kind: 'technical', priority: 'must' },
    ];
    const questions: Question[] = [
      { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'React question', answer_outline: '', difficulty: 2 },
    ];

    const { uncoveredIds, coveredIds } = findUncoveredRequirements(reqs, questions);
    expect(coveredIds).toEqual(['r1']);
    expect(uncoveredIds).toEqual(['r2']);
  });
});