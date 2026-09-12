import { CompanyScraper } from '../crawler/scraper';
import { extractRoleAndRequirements, synthesizeCompanyBrief } from './extractor';
import { generateInitialQuestions, generateFlashcards } from './generator';
import { findUncoveredRequirements, executeSecondPass } from './coverage';
import { buildDeterministicSchedule } from '../scheduler/scheduler';
import { validateKit } from '../types/schema';
import { PrepKit } from '../types/kit';

export interface PipelineInput {
  jd: string;
  company_url: string;
  days: number;
}

export async function runPrepKitPipeline(input: PipelineInput): Promise<PrepKit> {
  const jd = input.jd.trim();
  const companyUrl = input.company_url.trim();
  const days = Math.min(60, Math.max(1, Math.floor(input.days)));

  const scraper = new CompanyScraper();
  const crawl = await scraper.crawlCompany(companyUrl);
  if (crawl.unreachable) {
    const error = new Error(crawl.errorMessage || 'Company site is unreachable');
    (error as Error & { code?: string }).code = 'COMPANY_UNREACHABLE';
    throw error;
  }
  const role = await extractRoleAndRequirements(jd);
  const companyBrief = await synthesizeCompanyBrief(
    companyUrl,
    crawl.homePageText,
    crawl.hiringPageText,
    crawl.discussionText,
    crawl.pagesUsed
  );

  let questions = await generateInitialQuestions(role.title, role.requirements, companyBrief.summary);
  let coverage = findUncoveredRequirements(role.requirements, questions);
  let passes = 1;

  if (coverage.uncoveredIds.length > 0) {
    passes = 2;
    const uncovered = role.requirements.filter((requirement) => coverage.uncoveredIds.includes(requirement.id));
    questions = [...questions, ...(await executeSecondPass(uncovered, questions.length))];
    coverage = findUncoveredRequirements(role.requirements, questions);
  }

  if (coverage.uncoveredIds.length > 0) {
    const missing = role.requirements.filter((requirement) => coverage.uncoveredIds.includes(requirement.id));
    const fallback = missing.map((requirement, index) => ({
      id: `q${questions.length + index + 1}`,
      requirement_ids: [requirement.id],
      category: requirement.kind === 'behavioural' ? 'behavioural' as const : 'technical' as const,
      prompt: `Explain how you would demonstrate: ${requirement.text}`,
      answer_outline: `Give a concrete example and explain your approach to ${requirement.text}.`,
      difficulty: requirement.priority === 'must' ? 3 as const : 2 as const,
    }));
    questions = [...questions, ...fallback];
    coverage = findUncoveredRequirements(role.requirements, questions);
  }

  const flashcards = await generateFlashcards(role.requirements, questions);
  const schedule = buildDeterministicSchedule(days, questions, role.requirements);
  const company = new URL(companyUrl).hostname.replace(/^www\./, '');

  return validateKit({
    source: {
      company,
      company_url: companyUrl,
      role: role.title,
      location: 'Unspecified',
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: crawl.pagesUsed,
    },
    company_brief: companyBrief,
    role,
    questions,
    flashcards,
    schedule,
    coverage: { uncovered_requirement_ids: coverage.uncoveredIds, passes },
  });
}
