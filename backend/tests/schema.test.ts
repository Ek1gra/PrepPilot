import { validateKit } from '../src/types/schema';

const baseKit = {
  source: { company: 'example.com', company_url: 'https://example.com', role: 'Engineer', location: 'Remote / Unspecified', jd_chars: 20, researched_at: new Date().toISOString(), pages_used: ['https://example.com'] },
  company_brief: { summary: 'Summary', what_they_do: 'Product', sources: ['https://example.com'] },
  role: { title: 'Engineer', seniority: 'Mid', responsibilities: ['Build'], requirements: [{ id: 'r1', text: 'TypeScript', kind: 'technical', priority: 'must' }] },
  questions: [{ id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'Explain TypeScript.', answer_outline: 'Types and narrowing.', difficulty: 2 }],
  flashcards: [{ id: 'f1', front: 'TypeScript', back: 'Typed JavaScript.', requirement_ids: ['r1'] }],
  schedule: { days_available: 2, days: [{ day: 1, focus: 'Core', question_ids: ['q1'], minutes: 30 }, { day: 2, focus: 'Review', question_ids: [], minutes: 30 }] },
  coverage: { uncovered_requirement_ids: [], passes: 1 },
};

describe('kit structure validation', () => {
  it('accepts a valid Appendix A kit and cross references', () => {
    expect(validateKit(baseKit).schedule.days).toHaveLength(2);
  });

  it('rejects unknown question requirement ids', () => {
    expect(() => validateKit({ ...baseKit, questions: [{ ...baseKit.questions[0], requirement_ids: ['r404'] }] })).toThrow();
  });

  it('rejects a schedule with the wrong number of days', () => {
    expect(() => validateKit({ ...baseKit, schedule: { ...baseKit.schedule, days: [baseKit.schedule.days[0]] } })).toThrow();
  });
});
