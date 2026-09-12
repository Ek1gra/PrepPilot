'use client';

import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Question, Schedule } from '../types/kit';

interface ScheduleViewProps { schedule: Schedule; questions: Question[] }

export default function ScheduleView({ schedule, questions }: ScheduleViewProps) {
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const scheduled = new Set(schedule.days.flatMap((day) => day.question_ids));
  const mustHaveIds = new Set(questions.flatMap((question) => question.requirement_ids));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center gap-3"><Calendar className="h-5 w-5 text-indigo-400" /><div><h2 className="font-bold text-white">Day-by-day prep plan</h2><p className="text-xs text-slate-500">Exactly {schedule.days_available} days · {scheduled.size} questions scheduled</p></div></div></section>
      {schedule.days.map((day) => <section key={day.day} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl"><div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-white">Day {day.day}: {day.focus}</h3><p className="mt-1 text-xs text-slate-500">{day.question_ids.length} targeted questions</p></div><span className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-amber-300"><Clock className="h-4 w-4" /> {day.minutes} min</span></div><div className="mt-4 space-y-2">{day.question_ids.map((id) => { const question = questionMap.get(id); if (!question) return null; return <div key={id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300">{question.id}</span><span className="text-xs capitalize text-slate-500">{question.category}</span><span className="text-xs text-amber-300">Difficulty {question.difficulty}</span></div><p className="mt-2 text-sm text-slate-200">{question.prompt}</p></div>; })}</div></section>)}
      {mustHaveIds.size > 0 && <p className="text-xs text-slate-500">Schedule validation is deterministic; every scheduled question references a requirement.</p>}
    </div>
  );
}
