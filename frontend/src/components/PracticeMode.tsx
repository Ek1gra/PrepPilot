'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw } from 'lucide-react';
import { Flashcard } from '../types/kit';

interface PracticeModeProps { flashcards: Flashcard[] }

type Confidence = Record<string, 1 | 2 | 3>;

export default function PracticeMode({ flashcards }: PracticeModeProps) {
  const [cards, setCards] = useState(flashcards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [confidence, setConfidence] = useState<Confidence>({});

  useEffect(() => { setCards(flashcards); setIndex(0); setFlipped(false); }, [flashcards]);

  const current = cards[index];
  const reviewed = useMemo(() => Object.keys(confidence).length, [confidence]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;
      if (event.code === 'Space') { event.preventDefault(); setFlipped((value) => !value); }
      if (current && ['1', '2', '3'].includes(event.key)) rate(Number(event.key) as 1 | 2 | 3);
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') previous();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function next() { setFlipped(false); setIndex((value) => Math.min(value + 1, Math.max(cards.length - 1, 0))); }
  function previous() { setFlipped(false); setIndex((value) => Math.max(value - 1, 0)); }
  function rate(value: 1 | 2 | 3) {
    if (!current) return;
    setConfidence((previousValue) => ({ ...previousValue, [current.id]: value }));
    next();
  }
  function weakestFirst() {
    setCards([...cards].sort((a, b) => (confidence[a.id] || 0) - (confidence[b.id] || 0)));
    setIndex(0); setFlipped(false);
  }

  if (!cards.length) return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center text-sm text-slate-400">No flashcards generated yet.</div>;
  if (!current) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div><p className="text-xs text-slate-500">Practice progress</p><p className="text-sm font-semibold text-white">{index + 1} / {cards.length} · {reviewed} reviewed</p></div>
        <button onClick={weakestFirst} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-indigo-300"><RotateCw className="h-4 w-4" /> Weakest first</button>
      </div>
      <button onClick={() => setFlipped((value) => !value)} className="min-h-[300px] w-full rounded-3xl border border-slate-800 bg-slate-900 p-8 text-left shadow-xl hover:border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-500"><span className="rounded bg-slate-800 px-2 py-1 font-mono">{current.id}</span><span>Space to reveal</span></div>
        <div className="flex min-h-[220px] flex-col items-center justify-center text-center"><p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">{flipped ? 'Answer' : 'Recall prompt'}</p><p className="mt-3 text-xl font-medium leading-8 text-slate-100">{flipped ? current.back : current.front}</p></div>
      </button>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => rate(1)} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm font-semibold text-red-300 hover:border-red-900">1 · Needs work</button>
        <button onClick={() => rate(2)} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm font-semibold text-amber-300 hover:border-amber-900">2 · Good</button>
        <button onClick={() => rate(3)} className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm font-semibold text-emerald-300 hover:border-emerald-900">3 · Mastered</button>
      </div>
      <div className="flex justify-between"><button disabled={index === 0} onClick={previous} className="inline-flex items-center gap-1 text-sm text-slate-400 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /> Previous</button><button disabled={index === cards.length - 1} onClick={next} className="inline-flex items-center gap-1 text-sm text-slate-400 disabled:opacity-30">Next <ArrowRight className="h-4 w-4" /></button></div>
    </div>
  );
}
