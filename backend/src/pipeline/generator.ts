import { generateContentWithRetry } from '../config/llm';
import { Flashcard, Question, QuestionCategory, Requirement } from '../types/kit';

const CATEGORIES: QuestionCategory[] = [
  'technical',
  'behavioural',
  'system-design',
  'company-fit',
];

function normalizeQuestion(
  raw: any,
  id: string,
  requirements: Requirement[],
  category: QuestionCategory
): Question | null {
  const validIds: string[] = requirements.map((r) => r.id);

  const requirementIds: string[] = Array.isArray(raw?.requirement_ids)
    ? raw.requirement_ids.filter(
        (value: unknown): value is string =>
          typeof value === 'string' && validIds.includes(value)
      )
    : [];

  const prompt = String(raw?.prompt || '').trim();

  if (!prompt || requirementIds.length === 0) return null;

  const answerOutline = Array.isArray(raw?.answer_outline)
    ? raw.answer_outline
        .map((item: unknown) => String(item).trim())
        .filter(Boolean)
        .join('\n')
    : String(raw?.answer_outline || '').trim();

  const difficulty = Number(raw?.difficulty);

  return {
    id,
    requirement_ids: requirementIds,
    category,
    prompt,
    answer_outline:
      answerOutline ||
      'Explain your approach, trade-offs, and relevant experience.',
    difficulty: ([1, 2, 3].includes(difficulty) ? difficulty : 2) as
      | 1
      | 2
      | 3,
  };
}

function fallbackQuestion(
  requirement: Requirement,
  category: QuestionCategory,
  id: string
): Question {
  const text = requirement.text;

  const prompts: Record<QuestionCategory, string> = {
    technical: `How would you demonstrate your technical experience with: ${text}?`,
    behavioural: `Tell me about a time you demonstrated the ability required by: ${text}.`,
    'system-design': `How would you design a production system that satisfies this requirement: ${text}?`,
    'company-fit': `Why are you interested in a role where this requirement matters: ${text}?`,
  };

  const outlines: Record<QuestionCategory, string> = {
    technical:
      'Explain the relevant concepts and your hands-on experience.\nDescribe your implementation approach.\nMention trade-offs, testing, and production considerations.',
    behavioural:
      'Use a concrete example.\nExplain the situation, your actions, and the result.\nConnect the example back to the requirement.',
    'system-design':
      'Clarify requirements and constraints.\nDescribe the high-level architecture.\nDiscuss scalability, reliability, data flow, and trade-offs.',
    'company-fit':
      'Explain your motivation clearly.\nConnect your interests and experience to the requirement.\nAvoid unsupported claims about the company.',
  };

  return {
    id,
    requirement_ids: [requirement.id],
    category,
    prompt: prompts[category],
    answer_outline: outlines[category],
    difficulty: requirement.priority === 'must' ? 3 : 2,
  };
}

function fallbackQuestionsForCategory(
  requirements: Requirement[],
  category: QuestionCategory,
  startIndex: number
): Question[] {
  if (requirements.length === 0) return [];

  const requirement =
    requirements.find((item) => item.priority === 'must') ||
    requirements[0];

  return [fallbackQuestion(requirement, category, `q${startIndex}`)];
}

export async function generateQuestionsForCategory(
  roleTitle: string,
  requirements: Requirement[],
  companyBrief: string,
  category: QuestionCategory,
  startIndex = 1
): Promise<Question[]> {
  const prompt = `
Generate interview questions for the role "${roleTitle}".
Generate ONLY the ${category} category.

Company context:
${companyBrief}

Requirements:
${JSON.stringify(requirements, null, 2)}

Rules:
- Use only facts and requirements supplied above.
- Never invent a requirement.
- Every question must reference one or more supplied requirement ids.
- For behavioural questions, focus on behaviours implied by the supplied requirements.
- For system-design questions, focus on architecture implications of the supplied requirements.
- For company-fit questions, use company context only where evidence exists.
- If company evidence is unavailable, ask role-relevant motivation questions without inventing company facts.
- difficulty must be 1, 2, or 3.
- Return JSON only:
{
  "questions": [
    {
      "requirement_ids": ["r1"],
      "prompt": "...",
      "answer_outline": ["...", "..."],
      "difficulty": 1
    }
  ]
}
`;

  try {
    const parsed = JSON.parse(await generateContentWithRetry(prompt));
    const raw = Array.isArray(parsed.questions) ? parsed.questions : [];
    const result: Question[] = [];

    for (let i = 0; i < raw.length; i += 1) {
      const normalized = normalizeQuestion(
        raw[i],
        `q${startIndex + result.length}`,
        requirements,
        category
      );

      if (normalized) result.push(normalized);
    }

    if (result.length > 0) return result;
  } catch {
  }

  return fallbackQuestionsForCategory(
    requirements,
    category,
    startIndex
  );
}

export async function generateInitialQuestions(
  roleTitle: string,
  requirements: Requirement[],
  companyBrief: string
): Promise<Question[]> {
  if (requirements.length === 0) return [];

  const questions: Question[] = [];

  for (const category of CATEGORIES) {
    const generated = await generateQuestionsForCategory(
      roleTitle,
      requirements,
      companyBrief,
      category,
      questions.length + 1
    );

    questions.push(...generated);
  }

  return questions;
}

export async function generateFlashcards(
  requirements: Requirement[],
  questions: Question[]
): Promise<Flashcard[]> {
  if (requirements.length === 0) return [];

  const prompt = `
Create concise interview-prep flashcards from the supplied requirements and questions.

Requirements:
${JSON.stringify(requirements)}

Questions:
${JSON.stringify(questions)}

Rules:
- Every requirement_ids value must refer to a supplied requirement.
- Keep front and back concise and useful.
- Return JSON only:
{
  "flashcards": [
    {
      "front": "",
      "back": "",
      "requirement_ids": ["r1"]
    }
  ]
}
`;

  try {
    const parsed = JSON.parse(await generateContentWithRetry(prompt));
    const validIds: string[] = requirements.map((r) => r.id);
    const cards = Array.isArray(parsed.flashcards)
      ? parsed.flashcards
      : [];

    const result: Flashcard[] = [];

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];

      const ids: string[] = Array.isArray(card?.requirement_ids)
        ? card.requirement_ids.filter(
            (id: unknown): id is string =>
              typeof id === 'string' && validIds.includes(id)
          )
        : [];

      const front = String(card?.front || '').trim();
      const back = String(card?.back || '').trim();

      if (!front || !back || ids.length === 0) continue;

      result.push({
        id: `f${result.length + 1}`,
        front,
        back,
        requirement_ids: ids,
      });
    }

    if (result.length > 0) return result;
  } catch {
  }

  return requirements.map((requirement, index) => ({
    id: `f${index + 1}`,
    front: requirement.text,
    back: `Be ready to explain your experience, approach, and trade-offs for: ${requirement.text}`,
    requirement_ids: [requirement.id],
  }));
}