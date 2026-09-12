import { z } from 'zod';

export const RequirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(['technical', 'behavioural', 'domain']),
  priority: z.enum(['must', 'nice']),
});

export const RoleSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RequirementSchema),
});

export const QuestionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()).min(1),
  category: z.enum(['technical', 'behavioural', 'system-design', 'company-fit']),
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const FlashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()).min(1),
});

export const ScheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string().min(1),
  question_ids: z.array(z.string()),
  minutes: z.number().int().positive(),
});

export const ScheduleSchema = z.object({
  days_available: z.number().int().min(1).max(60),
  days: z.array(ScheduleDaySchema),
});

export const CoverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().min(1),
});

export const SourceInfoSchema = z.object({
  company: z.string(),
  company_url: z.string().url(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().nonnegative(),
  researched_at: z.string(),
  pages_used: z.array(z.string().url()),
});

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string().url()),
});

export const PrepKitSchema = z.object({
  source: SourceInfoSchema,
  company_brief: CompanyBriefSchema,
  role: RoleSchema,
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
  schedule: ScheduleSchema,
  coverage: CoverageSchema,
});

export function validateKit(data: unknown) {
  const kit = PrepKitSchema.parse(data);
  const requirementIds = new Set(kit.role.requirements.map((r) => r.id));
  const questionIds = new Set(kit.questions.map((q) => q.id));
  const flashcardIds = new Set(kit.flashcards.map((f) => f.id));

  if (requirementIds.size !== kit.role.requirements.length) throw new Error('Duplicate requirement id');
  if (questionIds.size !== kit.questions.length) throw new Error('Duplicate question id');
  if (flashcardIds.size !== kit.flashcards.length) throw new Error('Duplicate flashcard id');

  for (const question of kit.questions) {
    if (question.requirement_ids.some((id) => !requirementIds.has(id))) throw new Error(`Question ${question.id} references an unknown requirement`);
  }
  for (const card of kit.flashcards) {
    if (card.requirement_ids.some((id) => !requirementIds.has(id))) throw new Error(`Flashcard ${card.id} references an unknown requirement`);
  }

  if (kit.schedule.days.length !== kit.schedule.days_available) throw new Error('Schedule day count does not match days_available');
  const scheduledQuestionIds = new Set(kit.schedule.days.flatMap((day) => day.question_ids));
  for (const id of scheduledQuestionIds) {
    if (!questionIds.has(id)) throw new Error(`Schedule references unknown question ${id}`);
  }
  if (kit.coverage.uncovered_requirement_ids.some((id) => !requirementIds.has(id))) throw new Error('Coverage references an unknown requirement');

  return kit;
}
