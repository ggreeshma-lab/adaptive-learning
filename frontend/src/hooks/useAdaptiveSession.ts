import { useCallback, useEffect, useRef, useState } from "react";
import {
  evaluateAnswer,
  fetchMastery,
  generateQuestion,
  streamHint,
  type EvaluationResponse,
  type MasteryState,
  type Question,
  type Topic,
} from "@/services/api";

export const SESSION_LENGTH = 5;

export interface HintEntry {
  tier: 1 | 2 | 3;
  text: string;
  done: boolean;
}

export function useAdaptiveSession() {
  const [topic, setTopic] = useState<Topic>("Python Data Structures");
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [mastery, setMastery] = useState<MasteryState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [answered, setAnswered] = useState(0);
  const [streak, setStreak] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  const [hints, setHints] = useState<HintEntry[]>([]);
  const [tutorOpen, setTutorOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadQuestion = useCallback(async (t: Topic, exclude: string[], elo: number) => {
    abortRef.current?.abort();
    setLoading(true);
    setSelected(null);
    setEvaluation(null);
    setHints([]);
    setQuestionError(null);
    setActionError(null);
    try {
      const q = await generateQuestion(t, elo, exclude);
      setQuestion(q);
      setSeen((s) => [...s, q.id]);
    } catch (error) {
      setQuestion(null);
      setQuestionError(error instanceof Error ? error.message : "Unable to load a question.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMastery()
      .then((m) => {
        setMastery(m);
        setStreak(m.streak);
        loadQuestion(topic, [], m.elo);
      })
      .catch((error: unknown) => {
        setQuestionError(
          error instanceof Error ? error.message : "Unable to load learner progress.",
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTopic = (t: Topic) => {
    setTopic(t);
    setSeen([]);
    setAnswered(0);
    loadQuestion(t, [], mastery?.elo ?? 1400);
  };

  const runHint = useCallback(
    async (tier: 1 | 2 | 3) => {
      if (!question) return;
      setTutorOpen(true);
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setHints((h) => [...h.filter((x) => x.tier !== tier), { tier, text: "", done: false }]);
      setActionError(null);
      try {
        await streamHint(
          { questionId: question.id, tier, selectedOptionId: selected ?? undefined },
          (tok) =>
            setHints((h) => h.map((x) => (x.tier === tier ? { ...x, text: x.text + tok } : x))),
          ctrl.signal,
        );
        setHints((h) => h.map((x) => (x.tier === tier ? { ...x, done: true } : x)));
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to load a tutor hint.");
      }
    },
    [question, selected],
  );

  const requestHint = () => {
    const next = hints.some((h) => h.tier === 1) ? 2 : 1;
    if (next === 2 && hints.some((h) => h.tier === 2)) {
      setTutorOpen(true);
      return;
    }
    runHint(next);
  };

  const submit = async () => {
    if (!question || !selected) return;
    setLoading(true);
    setActionError(null);
    try {
      const ev = await evaluateAnswer(question.id, selected);
      setEvaluation(ev);
      setAnswered((a) => a + 1);
      const updatedMastery = await fetchMastery();
      setMastery(updatedMastery);
      setStreak(updatedMastery.streak);
      void runHint(3);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to submit your answer.");
    } finally {
      setLoading(false);
    }
  };

  const next = () => loadQuestion(topic, seen, mastery?.elo ?? 1400);
  const retryQuestion = () => loadQuestion(topic, seen, mastery?.elo ?? 1400);

  return {
    topic,
    changeTopic,
    question,
    questionError,
    retryQuestion,
    selected,
    setSelected,
    evaluation,
    actionError,
    loading,
    mastery,
    answered,
    streak,
    hints,
    tutorOpen,
    setTutorOpen,
    requestHint,
    submit,
    next,
  };
}
