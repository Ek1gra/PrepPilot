import { Question, Requirement, Schedule, ScheduleDay } from '../types/kit';

export function buildDeterministicSchedule(daysAvailable: number, questions: Question[], requirements: Requirement[]): Schedule {
  const daysCount = Math.min(60, Math.max(1, Math.floor(daysAvailable)));
  const priority = new Map(requirements.map((requirement) => [requirement.id, requirement.priority]));

  const scored = [...questions]
    .map((question) => ({
      question,
      score: question.difficulty * 2 + (question.requirement_ids.some((id) => priority.get(id) === 'must') ? 10 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.question.id.localeCompare(b.question.id));

  const days: ScheduleDay[] = Array.from({ length: daysCount }, (_, index) => ({
    day: index + 1,
    focus: '',
    question_ids: [],
    minutes: 30,
  }));

  scored.forEach(({ question }, index) => {
    const dayIndex = Math.min(index, daysCount - 1);
    if (index < daysCount) {
      days[dayIndex].question_ids.push(question.id);
    } else {
      const targets = days.slice(1);
      const target = targets.reduce((best, day) => day.question_ids.length < best.question_ids.length ? day : best, targets[0] || days[0]);
      target.question_ids.push(question.id);
    }
  });

  const categoryFocus: Record<string, string> = {
    technical: 'Technical Mastery & Core Problem Solving',
    behavioural: 'Behavioural & Scenario Practice',
    'system-design': 'System Design & Scalability',
    'company-fit': 'Company Fit & Hiring Process',
  };

  for (const day of days) {
    const dayQuestions = day.question_ids.map((id) => questions.find((question) => question.id === id)).filter(Boolean) as Question[];
    const categories = [...new Set(dayQuestions.map((question) => question.category))];
    day.focus = day.day === 1
      ? 'High-Priority Must-Haves & Hardest Topics'
      : categories.length === 1
        ? categoryFocus[categories[0]]
        : 'Mixed Interview Practice & Review';
    day.minutes = Math.max(30, day.question_ids.length * 15);
  }

  return { days_available: daysCount, days };
}
