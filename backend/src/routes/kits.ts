import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { KitModel } from '../models/kit';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { runPrepKitPipeline } from '../pipeline/orchestrator';
import { generateQuestionsForCategory } from '../pipeline/generator';
import { synthesizeCompanyBrief } from '../pipeline/extractor';
import { CompanyScraper } from '../crawler/scraper';
import { buildDeterministicSchedule } from '../scheduler/scheduler';
import { executeSecondPass, findUncoveredRequirements } from '../pipeline/coverage';
import { validateKit } from '../types/schema';

export const kitRouter = Router();

kitRouter.use(requireAuth);

const createSchema = z.object({
  jd: z.string().trim().min(10).max(100000),
  companyUrl: z.string().url().max(2048),
  days: z.coerce.number().int().min(1).max(60),
});

const updateSchema = z.object({
  kit: z.unknown(),
  itemStates: z
    .record(
      z.string(),
      z.object({
        isEdited: z.boolean().optional(),
        isPinned: z.boolean().optional(),
        isCustom: z.boolean().optional(),
      })
    )
    .default({}),
});

const regenerateSchema = z.object({
  section: z.enum(['company_brief', 'category', 'schedule']),
  category: z
    .enum(['technical', 'behavioural', 'system-design', 'company-fit'])
    .optional(),
});

function userId(req: AuthenticatedRequest): string {
  return req.user.id;
}

function validId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

kitRouter.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);

    const kit = await runPrepKitPipeline({
      jd: input.jd,
      company_url: input.companyUrl,
      days: input.days,
    });

    const doc = await KitModel.create({
      userId: userId(req as AuthenticatedRequest),
      rawInput: {
        jd: input.jd,
        companyUrl: input.companyUrl,
        days: input.days,
      },
      kit,
      itemStates: {},
    });

    res.status(201).json({
      id: doc._id.toString(),
      kit: doc.kit,
    });
  })
);

kitRouter.post(
  '/batch',
  asyncHandler(async (req, res) => {
    const cases = z
      .array(
        z.object({
          id: z.string().min(1),
          jd: z.string().min(10),
          company_url: z.string().url(),
          days: z.coerce.number().int().min(1).max(60),
        })
      )
      .parse(req.body?.cases);

    const owner = userId(req as AuthenticatedRequest);
    const kits = [];

    for (const item of cases) {
      try {
        const kit = await runPrepKitPipeline({
          jd: item.jd,
          company_url: item.company_url,
          days: item.days,
        });

        const doc = await KitModel.create({
          userId: owner,
          rawInput: {
            jd: item.jd,
            companyUrl: item.company_url,
            days: item.days,
          },
          kit,
          itemStates: {},
        });

        kits.push({
          id: item.id,
          status: 'ok' as const,
          kit: doc.kit,
          error: null,
        });
      } catch (error: any) {
        kits.push({
          id: item.id,
          status: 'failed' as const,
          kit: null,
          error: {
            code: error?.code || 'PIPELINE_ERROR',
            message: error?.message || 'Pipeline failed',
          },
        });
      }
    }

    res.json({
      version: '1.0',
      generated_at: new Date().toISOString(),
      kits,
    });
  })
);

kitRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const kits = await KitModel.find({
      userId: userId(req as AuthenticatedRequest),
    })
      .sort({ createdAt: -1 })
      .select('_id kit.source kit.company_brief createdAt updatedAt');

    res.json(kits);
  })
);

kitRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);

    if (!validId(id)) {
      res.status(400).json({ error: 'Invalid kit id' });
      return;
    }

    const doc = await KitModel.findOne({
      _id: id,
      userId: userId(req as AuthenticatedRequest),
    });

    if (!doc) {
      res.status(404).json({ error: 'Kit not found' });
      return;
    }

    res.json({
      id: doc._id.toString(),
      kit: doc.kit,
      itemStates: doc.itemStates,
    });
  })
);

kitRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);

    if (!validId(id)) {
      res.status(400).json({ error: 'Invalid kit id' });
      return;
    }

    const body = updateSchema.parse(req.body);
    const kit = validateKit(body.kit);

    const doc = await KitModel.findOneAndUpdate(
      {
        _id: id,
        userId: userId(req as AuthenticatedRequest),
      },
      {
        $set: {
          kit,
          itemStates: body.itemStates,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!doc) {
      res.status(404).json({ error: 'Kit not found' });
      return;
    }

    res.json({
      id: doc._id.toString(),
      kit: doc.kit,
      itemStates: doc.itemStates,
    });
  })
);

kitRouter.post(
  '/:id/regenerate-section',
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);

    if (!validId(id)) {
      res.status(400).json({ error: 'Invalid kit id' });
      return;
    }

    const input = regenerateSchema.parse(req.body);

    const doc = await KitModel.findOne({
      _id: id,
      userId: userId(req as AuthenticatedRequest),
    });

    if (!doc) {
      res.status(404).json({ error: 'Kit not found' });
      return;
    }

    const current = structuredClone(doc.kit);
    const states = doc.itemStates || {};

    if (input.section === 'company_brief') {
      const crawl = await new CompanyScraper().crawlCompany(
        doc.rawInput.companyUrl
      );

      current.company_brief = await synthesizeCompanyBrief(
        doc.rawInput.companyUrl,
        crawl.homePageText,
        crawl.hiringPageText,
        crawl.discussionText,
        crawl.pagesUsed
      );
    } else if (input.section === 'category') {
      if (!input.category) {
        res.status(400).json({ error: 'Category is required' });
        return;
      }

      const protectedQuestions = current.questions.filter(
        (question) =>
          question.category !== input.category ||
          states[question.id]?.isEdited ||
          states[question.id]?.isPinned ||
          states[question.id]?.isCustom
      );

      const nextQuestions = await generateQuestionsForCategory(
        current.role.title,
        current.role.requirements,
        current.company_brief.summary,
        input.category,
        1
      );

      const usedIds = new Set(
        protectedQuestions.map((question) => question.id)
      );

      const fresh = nextQuestions
        .map((question, index) => ({
          ...question,
          id: `q${current.questions.length + index + 1}`,
        }))
        .filter((question) => !usedIds.has(question.id));

      current.questions = [...protectedQuestions, ...fresh];

      let coverage = findUncoveredRequirements(
        current.role.requirements,
        current.questions
      );

      if (coverage.uncoveredIds.length) {
        const missing = current.role.requirements.filter((requirement) =>
          coverage.uncoveredIds.includes(requirement.id)
        );

        current.questions.push(
          ...(await executeSecondPass(
            missing,
            current.questions.length
          ))
        );

        coverage = findUncoveredRequirements(
          current.role.requirements,
          current.questions
        );
      }

      current.coverage = {
        uncovered_requirement_ids: coverage.uncoveredIds,
        passes: Math.max(current.coverage.passes, 2),
      };

      current.schedule = buildDeterministicSchedule(
        doc.rawInput.days,
        current.questions,
        current.role.requirements
      );
    } else {
      current.schedule = buildDeterministicSchedule(
        doc.rawInput.days,
        current.questions,
        current.role.requirements
      );
    }

    const validated = validateKit(current);

    doc.kit = validated;
    await doc.save();

    res.json({
      id: doc._id.toString(),
      kit: doc.kit,
      itemStates: doc.itemStates,
    });
  })
);