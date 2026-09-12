import { generateContentWithRetry } from '../config/llm';
import { Question, Requirement } from '../types/kit';

export interface CoverageResult {
  uncoveredIds: string[];
  coveredIds: string[];
}

export function findUncoveredRequirements(requirements: Requirement[], questions: Question[]): CoverageResult {
  const covered = new Set(questions.flatMap((question) => question.requirement_ids));
  const coveredIds = requirements.filter((requirement) => covered.has(requirement.id)).map((requirement) => requirement.id);
  const uncoveredIds = requirements.filter((requirement) => !covered.has(requirement.id)).map((requirement) => requirement.id);
  return { uncoveredIds, coveredIds };
}

export async function executeSecondPass(uncoveredRequirements: Requirement[], existingQuestionsCount: number): Promise<Question[]> {
  if (uncoveredRequirements.length === 0) return [];

  const prompt = `
Generate targeted interview questions for ONLY these uncovered requirements:
${JSON.stringify(uncoveredRequirements, null, 2)}

Rules:
- Every question must reference at least one of the supplied requirement ids.
- Use category technical for technical requirements, behavioural for behavioural requirements, and company-fit or system-design only when justified.
- difficulty must be 1, 2, or 3.
- Return JSON only: { "questions": [...] }
`;

  try {
    const parsed = JSON.parse(await generateContentWithRetry(prompt));
    const validIds = new Set(uncoveredRequirements.map((r) => r.id));
    const raw = Array.isArray(parsed.questions) ? parsed.questions : [];
    return raw.map((q: any, index: number) => {
      const ids = Array.isArray(q?.requirement_ids)
        ? q.requirement_ids.filter((id: unknown): id is string => typeof id === 'string' && validIds.has(id))
        : [];
      const fallbackId = uncoveredRequirements[index % uncoveredRequirements.length]?.id;
      const requirementIds = ids.length ? ids : fallbackId ? [fallbackId] : [];
      const category = ['technical', 'behavioural', 'system-design', 'company-fit'].includes(q?.category)
        ? q.category
        : 'technical';
      return {
        id: `q${existingQuestionsCount + index + 1}`,
        requirement_ids: requirementIds,
        category,
        prompt: String(q?.prompt || '').trim() || `Explain your experience with ${uncoveredRequirements[index % uncoveredRequirements.length]?.text || 'this requirement'}.`,
        answer_outline: Array.isArray(q?.answer_outline) ? q.answer_outline.join('\n') : String(q?.answer_outline || '').trim(),
        difficulty: ([1, 2, 3].includes(Number(q?.difficulty)) ? Number(q.difficulty) : 2) as 1 | 2 | 3,
      };
    }).filter((q: Question) => q.requirement_ids.length > 0);
  } catch {
    return uncoveredRequirements.map((requirement, index) => ({
      id: `q${existingQuestionsCount + index + 1}`,
      requirement_ids: [requirement.id],
      category: requirement.kind === 'behavioural' ? 'behavioural' : 'technical',
      prompt: `Explain how you would demonstrate: ${requirement.text}`,
      answer_outline: `State the relevant experience, explain your approach, and give a concrete example for ${requirement.text}.`,
      difficulty: requirement.priority === 'must' ? 3 : 2,
    }));
  }
}
