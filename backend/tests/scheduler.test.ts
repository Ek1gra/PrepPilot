import { buildDeterministicSchedule } from '../src/scheduler/scheduler';
import { Question, Requirement } from '../src/types/kit';

describe('Deterministic Scheduler', () => {
  const reqs: Requirement[] = [
    { id: 'r1', text: '5+ years with React', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Mentoring juniors', kind: 'behavioural', priority: 'nice' },
  ];

  const questions: Question[] = [
    { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'Explain React fibers', answer_outline: 'Fiber architecture...', difficulty: 3 },
    { id: 'q2', requirement_ids: ['r2'], category: 'behavioural', prompt: 'Tell me about a time you mentored', answer_outline: 'STAR format...', difficulty: 1 },
    { id: 'q3', requirement_ids: ['r1'], category: 'technical', prompt: 'Virtual DOM reconciliation', answer_outline: 'Diffing algorithm...', difficulty: 2 },
  ];

  it('allocates across exactly the requested number of days', () => {
    const schedule = buildDeterministicSchedule(3, questions, reqs);
    expect(schedule.days.length).toBe(3);
    expect(schedule.days_available).toBe(3);
  });

  it('ensures durations are integer minutes (no floats)', () => {
    const schedule = buildDeterministicSchedule(4, questions, reqs);
    schedule.days.forEach((day) => {
      expect(Number.isInteger(day.minutes)).toBe(true);
      expect(day.minutes).toBeGreaterThan(0);
    });
  });

  it('schedules harder and must-have requirements in earlier days', () => {
    const schedule = buildDeterministicSchedule(2, questions, reqs);
    // Day 1 must contain the highest priority/difficulty question (q1)
    expect(schedule.days[0].question_ids).toContain('q1');
  });
});