/**
 * AdaptIQ API layer.
 * Set VITE_USE_LIVE_QUESTIONS=true to fetch questions from the FastAPI server.
 */
const API_HOST = import.meta.env.VITE_API_HOST;
export const API_BASE =
  (API_HOST ? `https://${API_HOST}/api` : import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:8000/api";
export const USE_LIVE_QUESTIONS = import.meta.env.VITE_USE_LIVE_QUESTIONS === "true";
const USE_MOCK = true;

export type Topic = "Python Data Structures" | "System Design" | "SQL Query Optimization";
export const TOPICS: Topic[] = [
  "Python Data Structures",
  "System Design",
  "SQL Query Optimization",
];

export interface QuestionOption {
  id: string;
  text: string;
}
export interface Question {
  id: string;
  topic: Topic;
  difficulty: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string; // markdown with ``` code fences
  options: QuestionOption[];
  skill: string;
}
export interface EvaluationResponse {
  correct: boolean;
  correctOptionId: string;
  eloDelta: number;
  newElo: number;
  misconception?: string | undefined;
  breakdown: string; // markdown
}
export interface MasteryState {
  elo: number;
  categories: { name: string; score: number }[];
  misconceptions: string[];
  nextSteps: string[];
  streak: number;
  totalAnswered: number;
}
export interface HintRequest {
  questionId: string;
  tier: 1 | 2 | 3;
  selectedOptionId?: string | undefined;
}

export interface AuthUser {
  id: string;
  email: string;
}

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));
let csrfToken: string | null = null;

interface MockQ extends Question {
  answer: string;
  hints: [string, string];
  breakdown: string;
  misconception: string;
}

const BANK: MockQ[] = [
  {
    id: "py-1",
    topic: "Python Data Structures",
    difficulty: 2,
    skill: "Time Complexity",
    title: "Membership test cost",
    body: "What is the average time complexity of the membership check below?\n\n```python\nitems = set(range(1_000_000))\nprint(999_999 in items)\n```",
    options: [
      { id: "a", text: "O(1)" },
      { id: "b", text: "O(log n)" },
      { id: "c", text: "O(n)" },
      { id: "d", text: "O(n log n)" },
    ],
    answer: "a",
    hints: [
      "Think about **how** a `set` stores its elements internally.",
      "If a `set` scanned every element like a `list`, why would Python bother having both types?",
    ],
    misconception: "Treating hash-based containers like sequential lists",
    breakdown:
      "1. A `set` is backed by a **hash table**.\n2. `x in s` computes `hash(x)` and jumps to a bucket.\n3. Collisions are rare on average, so lookup is **O(1)**.\n\n```python\n# list: O(n) scan\n999_999 in list(items)\n# set: O(1) hash lookup\n999_999 in items\n```",
  },
  {
    id: "py-2",
    topic: "Python Data Structures",
    difficulty: 3,
    skill: "Memory",
    title: "Mutable default argument",
    body: "What does this print on the second call?\n\n```python\ndef add(x, bucket=[]):\n    bucket.append(x)\n    return bucket\n\nadd(1)\nprint(add(2))\n```",
    options: [
      { id: "a", text: "[2]" },
      { id: "b", text: "[1, 2]" },
      { id: "c", text: "TypeError" },
      { id: "d", text: "[]" },
    ],
    answer: "b",
    hints: [
      "When exactly is a default argument value **evaluated**?",
      "If the list is created once at definition time, what happens to it across calls?",
    ],
    misconception: "Assuming default arguments are re-created per call",
    breakdown:
      "1. Defaults are evaluated **once**, when `def` runs.\n2. Both calls share the same list object.\n3. Fix with a sentinel:\n\n```python\ndef add(x, bucket=None):\n    bucket = [] if bucket is None else bucket\n```",
  },
  {
    id: "sd-1",
    topic: "System Design",
    difficulty: 3,
    skill: "Scalability",
    title: "Read-heavy hot keys",
    body: "A product page receives 50k reads/sec but updates once per hour. What's the **first** optimization to reach for?",
    options: [
      { id: "a", text: "Shard the database" },
      { id: "b", text: "Add a cache with TTL in front of the DB" },
      { id: "c", text: "Switch to a message queue" },
      { id: "d", text: "Vertical scale the DB" },
    ],
    answer: "b",
    hints: [
      "Look at the **ratio** of reads to writes.",
      "If the data barely changes, why fetch it from the source of truth every time?",
    ],
    misconception: "Reaching for sharding before caching",
    breakdown:
      "1. Read/write ratio is extreme → data is highly cacheable.\n2. A cache (Redis/CDN) with TTL ≈ update interval absorbs reads.\n3. Sharding adds complexity without addressing repeated identical reads.",
  },
  {
    id: "sql-1",
    topic: "SQL Query Optimization",
    difficulty: 4,
    skill: "Indexing",
    title: "Why isn't the index used?",
    body: "There is an index on `created_at`. Why might this query still do a full scan?\n\n```sql\nSELECT * FROM orders\nWHERE DATE(created_at) = '2026-10-05';\n```",
    options: [
      { id: "a", text: "SELECT * disables indexes" },
      { id: "b", text: "Wrapping the column in a function prevents index use" },
      { id: "c", text: "Date literals can't be indexed" },
      { id: "d", text: "The table needs VACUUM" },
    ],
    answer: "b",
    hints: [
      "The index stores raw `created_at` values. What is the query actually comparing?",
      "Can the planner seek a B-tree on `DATE(created_at)` if only `created_at` is indexed?",
    ],
    misconception: "Non-sargable predicates",
    breakdown:
      "1. The B-tree is keyed by `created_at`, not `DATE(created_at)`.\n2. Applying a function makes the predicate **non-sargable**.\n3. Rewrite as a range:\n\n```sql\nWHERE created_at >= '2026-10-05'\n  AND created_at <  '2026-10-06'\n```",
  },
];

let mockElo = 1420;
const mockMastery: MasteryState = {
  elo: mockElo,
  categories: [
    { name: "Time Complexity", score: 85 },
    { name: "Memory", score: 60 },
    { name: "Syntax", score: 90 },
    { name: "Scalability", score: 55 },
    { name: "Indexing", score: 48 },
  ],
  misconceptions: ["Confusing amortized vs worst-case complexity"],
  nextSteps: ["Practice hash-table internals", "Review sargable SQL predicates"],
  streak: 3,
  totalAnswered: 0,
};

const find = (id: string) => BANK.find((q) => q.id === id)!;
const strip = ({ answer, hints, breakdown, misconception, ...q }: MockQ): Question => q;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include" });
  if (!response.ok) throw new Error(`Unable to initialize secure session (${response.status})`);
  const data = (await response.json()) as { csrf_token: string };
  csrfToken = data.csrf_token;
  return csrfToken;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers);
  if (method !== "GET" && method !== "HEAD") {
    headers.set("X-CSRF-Token", await getCsrfToken());
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    method,
    credentials: "include",
    headers,
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String(payload.detail)
        : `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return payload as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!USE_LIVE_QUESTIONS) return null;
  try {
    return await apiRequest<AuthUser>("/auth/me");
  } catch (error) {
    if (error instanceof Error && error.message === "Login required") return null;
    if (error instanceof Error && error.message === "Session expired; please log in again")
      return null;
    throw error;
  }
}

export async function registerAccount(email: string, password: string): Promise<AuthUser> {
  return postJson<AuthUser>("/auth/register", { email, password });
}

export async function loginAccount(email: string, password: string): Promise<AuthUser> {
  return postJson<AuthUser>("/auth/login", { email, password });
}

export async function logoutAccount(): Promise<void> {
  await postJson<{ status: string }>("/auth/logout", {});
  csrfToken = null;
}

// ---------- Public API ----------
export async function generateQuestion(
  topic: Topic,
  elo: number,
  excludeIds: string[] = [],
): Promise<Question> {
  if (USE_LIVE_QUESTIONS) {
    return postJson<Question>("/generate-question", { topic, elo, exclude_ids: excludeIds });
  }
  await delay();
  const pool = BANK.filter((q) => q.topic === topic);
  const next =
    pool.find((q) => !excludeIds.includes(q.id)) ?? pool[excludeIds.length % pool.length];
  return strip(next!);
}

export async function evaluateAnswer(
  questionId: string,
  selectedOptionId: string,
): Promise<EvaluationResponse> {
  if (USE_LIVE_QUESTIONS)
    return postJson<EvaluationResponse>("/evaluate", {
      question_id: questionId,
      selected_option_id: selectedOptionId,
    });
  await delay();
  const q = find(questionId);
  const correct = q.answer === selectedOptionId;
  const eloDelta = correct ? 12 + q.difficulty * 2 : -(8 + q.difficulty);
  mockElo += eloDelta;
  const cat = mockMastery.categories.find((c) => c.name === q.skill);
  if (cat) cat.score = Math.max(0, Math.min(100, cat.score + (correct ? 6 : -4)));
  if (!correct && !mockMastery.misconceptions.includes(q.misconception))
    mockMastery.misconceptions.unshift(q.misconception);
  mockMastery.elo = mockElo;
  return {
    correct,
    correctOptionId: q.answer,
    eloDelta,
    newElo: mockElo,
    misconception: correct ? undefined : q.misconception,
    breakdown: q.breakdown,
  };
}

export async function fetchMastery(): Promise<MasteryState> {
  if (USE_LIVE_QUESTIONS) return apiRequest<MasteryState>("/mastery");
  await delay();
  return structuredClone(mockMastery);
}

/**
 * Streams a Socratic hint token-by-token.
 * Real mode: expects an SSE endpoint at GET /api/hint?question_id=..&tier=..
 */
export async function streamHint(
  req: HintRequest,
  onToken: (t: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (USE_LIVE_QUESTIONS) {
    if (signal?.aborted) return;
    const params = new URLSearchParams({
      question_id: req.questionId,
      tier: String(req.tier),
    });
    if (req.selectedOptionId) params.set("selected", req.selectedOptionId);
    const url = `${API_BASE}/hint?${params.toString()}`;
    await new Promise<void>((resolve, reject) => {
      const es = new EventSource(url, { withCredentials: true });
      const abort = () => {
        es.close();
        resolve();
      };
      signal?.addEventListener("abort", abort, { once: true });
      es.onmessage = (event) => {
        if (event.data === "[DONE]") {
          es.close();
          signal?.removeEventListener("abort", abort);
          resolve();
          return;
        }
        try {
          const token: unknown = JSON.parse(event.data);
          if (typeof token !== "string") throw new Error("Invalid tutor response.");
          onToken(token);
        } catch (error) {
          es.close();
          signal?.removeEventListener("abort", abort);
          reject(error instanceof Error ? error : new Error("Invalid tutor response."));
        }
      };
      es.onerror = () => {
        es.close();
        signal?.removeEventListener("abort", abort);
        reject(new Error("Tutor stream failed. Check the API key and backend logs."));
      };
    });
    return;
  }
  await delay();
  const q = find(req.questionId);
  const text = (req.tier === 3 ? q.breakdown : q.hints[req.tier - 1]) ?? "";
  const tokens = text.match(/\s+|[^\s]+/g) ?? [];
  for (const t of tokens) {
    if (signal?.aborted) return;
    onToken(t);
    await delay(18 + Math.random() * 30);
  }
}
