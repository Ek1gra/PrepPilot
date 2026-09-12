'use client';

import React, { useMemo, useState } from 'react';
import { PrepKit, Question, QuestionCategory, ItemStates } from '../types/kit';
import { ArrowDown, ArrowUp, Pin, Plus, Sparkles, Trash2 } from 'lucide-react';

interface BuilderProps {
  kit: PrepKit;
  itemStates: ItemStates;
  onUpdateKit: (kit: PrepKit, states: ItemStates) => void;
  onRegenerateSection: (section: 'company_brief' | 'category' | 'schedule', category?: QuestionCategory) => Promise<void>;
}

const CATEGORIES: QuestionCategory[] = ['technical', 'system-design', 'behavioural', 'company-fit'];

export default function Builder({ kit, itemStates, onUpdateKit, onRegenerateSection }: BuilderProps) {
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const requirementIds = useMemo(() => kit.role.requirements.map((r) => r.id), [kit.role.requirements]);

  const updateQuestion = (id: string, field: 'prompt' | 'answer_outline', value: string) => {
    const questions = kit.questions.map((question) => question.id === id ? { ...question, [field]: value } : question);
    const states = { ...itemStates, [id]: { ...itemStates[id], isEdited: true } };
    onUpdateKit({ ...kit, questions }, states);
  };

  const updateBrief = (field: 'summary' | 'what_they_do', value: string) => {
    onUpdateKit({ ...kit, company_brief: { ...kit.company_brief, [field]: value } }, itemStates);
  };

  const togglePin = (id: string) => {
    const states = { ...itemStates, [id]: { ...itemStates[id], isPinned: !itemStates[id]?.isPinned } };
    onUpdateKit(kit, states);
  };

  const deleteQuestion = (id: string) => {
    const questions = kit.questions.filter((question) => question.id !== id);
    onUpdateKit({ ...kit, questions }, itemStates);
  };

  const moveQuestion = (id: string, direction: -1 | 1) => {
    const current = kit.questions.find((question) => question.id === id);
    if (!current) return;
    const categoryQuestions = kit.questions.filter((question) => question.category === current.category);
    const index = categoryQuestions.findIndex((question) => question.id === id);
    const target = index + direction;
    if (target < 0 || target >= categoryQuestions.length) return;
    [categoryQuestions[index], categoryQuestions[target]] = [categoryQuestions[target], categoryQuestions[index]];
    let cursor = 0;
    const questions = kit.questions.map((question) => question.category === current.category ? categoryQuestions[cursor++] : question);
    const states = { ...itemStates, [id]: { ...itemStates[id], isEdited: true } };
    onUpdateKit({ ...kit, questions }, states);
  };

  const changeCategory = (id: string, category: QuestionCategory) => {
    const questions = kit.questions.map((question) => question.id === id ? { ...question, category } : question);
    const states = { ...itemStates, [id]: { ...itemStates[id], isEdited: true } };
    onUpdateKit({ ...kit, questions }, states);
  };

  const addQuestion = (category: QuestionCategory) => {
    if (!requirementIds.length) return;
    const id = `q_custom_${Date.now()}`;
    const question: Question = {
      id,
      requirement_ids: [requirementIds[0]],
      category,
      prompt: 'Write your interview question…',
      answer_outline: 'Add the key points you would use in a strong answer.',
      difficulty: 2,
    };
    const states = { ...itemStates, [id]: { isCustom: true, isPinned: true, isEdited: true } };
    onUpdateKit({ ...kit, questions: [...kit.questions, question] }, states);
  };

  const regenerate = async (section: 'company_brief' | 'category' | 'schedule', category?: QuestionCategory) => {
    const key = category ? `category:${category}` : section;
    setRegenerating(key);
    try {
      await onRegenerateSection(section, category);
    } finally {
      setRegenerating(null);
    }
  };

  const updateFlashcard = (id: string, field: 'front' | 'back', value: string) => {
    const flashcards = kit.flashcards.map((card) => card.id === id ? { ...card, [field]: value } : card);
    const states = { ...itemStates, [id]: { ...itemStates[id], isEdited: true } };
    onUpdateKit({ ...kit, flashcards }, states);
  };

  const deleteFlashcard = (id: string) => {
    onUpdateKit({ ...kit, flashcards: kit.flashcards.filter((card) => card.id !== id) }, itemStates);
  };

  const addFlashcard = () => {
    if (!requirementIds.length) return;
    const id = `f_custom_${Date.now()}`;
    const states = { ...itemStates, [id]: { isCustom: true, isPinned: true, isEdited: true } };
    onUpdateKit({ ...kit, flashcards: [...kit.flashcards, { id, front: 'New concept', back: 'Add a concise answer.', requirement_ids: [requirementIds[0]] }] }, states);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Research</p>
            <h2 className="text-xl font-bold text-white">Company Brief & Intelligence</h2>
          </div>
          <button disabled={regenerating === 'company_brief'} onClick={() => regenerate('company_brief')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-indigo-300 disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> {regenerating === 'company_brief' ? 'Regenerating…' : 'Regenerate Brief'}
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-400">What they do<textarea value={kit.company_brief.what_they_do} onChange={(e) => updateBrief('what_they_do', e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100" /></label>
          <label className="block text-xs font-medium text-slate-400">Hiring process & summary<textarea value={kit.company_brief.summary} onChange={(e) => updateBrief('summary', e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-100" /></label>
          {kit.company_brief.sources.length > 0 && <p className="text-xs text-slate-500">Research sources: {kit.company_brief.sources.length}</p>}
        </div>
      </section>

      {CATEGORIES.map((category) => {
        const questions = kit.questions.filter((question) => question.category === category);
        return (
          <section key={category} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Question bank</p>
                <h3 className="text-lg font-bold capitalize text-white">{category.replace('-', ' ')} questions</h3>
                <p className="text-xs text-slate-500">{questions.length} questions</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => addQuestion(category)} disabled={!requirementIds.length} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"><Plus className="h-4 w-4" /> Add</button>
                <button onClick={() => regenerate('category', category)} disabled={regenerating === `category:${category}`} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Sparkles className="h-4 w-4" /> {regenerating === `category:${category}` ? 'Regenerating…' : 'Regenerate Track'}</button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {questions.length === 0 && <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">No questions in this track yet.</div>}
              {questions.map((question) => {
                const state = itemStates[question.id];
                const categoryIndex = questions.findIndex((item) => item.id === question.id);
                return (
                  <article key={question.id} className={`rounded-xl border p-4 ${state?.isPinned ? 'border-indigo-500/50 bg-indigo-950/20' : 'border-slate-800 bg-slate-950/60'}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300">{question.id}</span>
                        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-amber-300">Difficulty {question.difficulty}</span>
                        {state?.isEdited && <span className="rounded bg-emerald-950 px-2 py-1 text-xs text-emerald-300">Edited</span>}
                        {state?.isPinned && <span className="rounded bg-indigo-950 px-2 py-1 text-xs text-indigo-300">Pinned</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select aria-label={`Category for ${question.id}`} value={question.category} onChange={(e) => changeCategory(question.id, e.target.value as QuestionCategory)} className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200">
                          {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <button aria-label={`Move ${question.id} up`} onClick={() => moveQuestion(question.id, -1)} disabled={categoryIndex === 0} className="rounded p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                        <button aria-label={`Move ${question.id} down`} onClick={() => moveQuestion(question.id, 1)} disabled={categoryIndex === questions.length - 1} className="rounded p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                        <button aria-label={`${state?.isPinned ? 'Unpin' : 'Pin'} ${question.id}`} onClick={() => togglePin(question.id)} className="rounded p-2 text-indigo-300 hover:bg-slate-800"><Pin className="h-4 w-4" /></button>
                        <button aria-label={`Delete ${question.id}`} onClick={() => deleteQuestion(question.id)} className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <textarea aria-label={`Prompt for ${question.id}`} value={question.prompt} onChange={(e) => updateQuestion(question.id, 'prompt', e.target.value)} rows={2} className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm font-medium text-slate-100" />
                    <textarea aria-label={`Answer outline for ${question.id}`} value={question.answer_outline} onChange={(e) => updateQuestion(question.id, 'answer_outline', e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300" />
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Practice material</p><h3 className="text-lg font-bold text-white">Flashcards</h3></div>
          <button onClick={addFlashcard} disabled={!requirementIds.length} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"><Plus className="h-4 w-4" /> Add Flashcard</button>
        </div>
        <div className="mt-4 space-y-3">
          {kit.flashcards.map((card) => (
            <div key={card.id} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1fr_1fr_auto]">
              <textarea aria-label={`Front of ${card.id}`} value={card.front} onChange={(e) => updateFlashcard(card.id, 'front', e.target.value)} rows={3} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-100" />
              <textarea aria-label={`Back of ${card.id}`} value={card.back} onChange={(e) => updateFlashcard(card.id, 'back', e.target.value)} rows={3} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300" />
              <button aria-label={`Delete ${card.id}`} onClick={() => deleteFlashcard(card.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Deterministic allocation</p><h3 className="text-lg font-bold text-white">Schedule</h3></div>
          <button disabled={regenerating === 'schedule'} onClick={() => regenerate('schedule')} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Sparkles className="h-4 w-4" /> {regenerating === 'schedule' ? 'Rebuilding…' : 'Rebuild Schedule'}</button>
        </div>
        <p className="mt-2 text-sm text-slate-400">{kit.schedule.days_available} days · {kit.schedule.days.reduce((sum, day) => sum + day.question_ids.length, 0)} scheduled questions</p>
      </section>
    </div>
  );
}
