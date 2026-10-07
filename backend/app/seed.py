from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Question


@dataclass(frozen=True)
class QuestionSeed:
    id: str
    topic: str
    difficulty: int
    skill: str
    title: str
    body: str
    options: list[dict[str, str]]
    correct_option_id: str
    hints: list[str]
    misconception: str
    breakdown: str


QUESTION_BANK = (
    QuestionSeed(
        id="py-1",
        topic="Python Data Structures",
        difficulty=2,
        skill="Time Complexity",
        title="Membership test cost",
        body=(
            "What is the average time complexity of the membership check below?\n\n"
            "```python\n"
            "items = set(range(1_000_000))\n"
            "print(999_999 in items)\n"
            "```"
        ),
        options=[
            {"id": "a", "text": "O(1)"},
            {"id": "b", "text": "O(log n)"},
            {"id": "c", "text": "O(n)"},
            {"id": "d", "text": "O(n log n)"},
        ],
        correct_option_id="a",
        hints=[
            "Think about **how** a `set` stores its elements internally.",
            "If a `set` scanned every element like a `list`, why would Python bother having both types?",
        ],
        misconception="Treating hash-based containers like sequential lists",
        breakdown=(
            "1. A `set` is backed by a **hash table**.\n"
            "2. `x in s` computes `hash(x)` and jumps to a bucket.\n"
            "3. Collisions are rare on average, so lookup is **O(1)**.\n\n"
            "```python\n"
            "# list: O(n) scan\n"
            "999_999 in list(items)\n"
            "# set: O(1) hash lookup\n"
            "999_999 in items\n"
            "```"
        ),
    ),
    QuestionSeed(
        id="py-2",
        topic="Python Data Structures",
        difficulty=3,
        skill="Memory",
        title="Mutable default argument",
        body=(
            "What does this print on the second call?\n\n"
            "```python\n"
            "def add(x, bucket=[]):\n"
            "    bucket.append(x)\n"
            "    return bucket\n\n"
            "add(1)\n"
            "print(add(2))\n"
            "```"
        ),
        options=[
            {"id": "a", "text": "[2]"},
            {"id": "b", "text": "[1, 2]"},
            {"id": "c", "text": "TypeError"},
            {"id": "d", "text": "[]"},
        ],
        correct_option_id="b",
        hints=[
            "When exactly is a default argument value **evaluated**?",
            "If the list is created once at definition time, what happens to it across calls?",
        ],
        misconception="Assuming default arguments are re-created per call",
        breakdown=(
            "1. Defaults are evaluated **once**, when `def` runs.\n"
            "2. Both calls share the same list object.\n"
            "3. Fix with a sentinel:\n\n"
            "```python\n"
            "def add(x, bucket=None):\n"
            "    bucket = [] if bucket is None else bucket\n"
            "```"
        ),
    ),
    QuestionSeed(
        id="sd-1",
        topic="System Design",
        difficulty=3,
        skill="Scalability",
        title="Read-heavy hot keys",
        body=(
            "A product page receives 50k reads/sec but updates once per hour. "
            "What's the **first** optimization to reach for?"
        ),
        options=[
            {"id": "a", "text": "Shard the database"},
            {"id": "b", "text": "Add a cache with TTL in front of the DB"},
            {"id": "c", "text": "Switch to a message queue"},
            {"id": "d", "text": "Vertical scale the DB"},
        ],
        correct_option_id="b",
        hints=[
            "Look at the **ratio** of reads to writes.",
            "If the data barely changes, why fetch it from the source of truth every time?",
        ],
        misconception="Reaching for sharding before caching",
        breakdown=(
            "1. Read/write ratio is extreme, so the data is highly cacheable.\n"
            "2. A cache (Redis/CDN) with a TTL near the update interval absorbs reads.\n"
            "3. Sharding adds complexity without addressing repeated identical reads."
        ),
    ),
    QuestionSeed(
        id="sql-1",
        topic="SQL Query Optimization",
        difficulty=4,
        skill="Indexing",
        title="Why isn't the index used?",
        body=(
            "There is an index on `created_at`. Why might this query still do a full scan?\n\n"
            "```sql\n"
            "SELECT * FROM orders\n"
            "WHERE DATE(created_at) = '2026-10-05';\n"
            "```"
        ),
        options=[
            {"id": "a", "text": "SELECT * disables indexes"},
            {"id": "b", "text": "Wrapping the column in a function prevents index use"},
            {"id": "c", "text": "Date literals can't be indexed"},
            {"id": "d", "text": "The table needs VACUUM"},
        ],
        correct_option_id="b",
        hints=[
            "The index stores raw `created_at` values. What is the query actually comparing?",
            "Can the planner seek a B-tree on `DATE(created_at)` if only `created_at` is indexed?",
        ],
        misconception="Non-sargable predicates",
        breakdown=(
            "1. The B-tree is keyed by `created_at`, not `DATE(created_at)`.\n"
            "2. Applying a function makes the predicate **non-sargable**.\n"
            "3. Rewrite as a range:\n\n"
            "```sql\n"
            "WHERE created_at >= '2026-10-05'\n"
            "  AND created_at <  '2026-10-06'\n"
            "```"
        ),
    ),
)


def seed_questions(session: Session) -> None:
    for question_data in QUESTION_BANK:
        existing = session.get(Question, question_data.id)
        if existing is None:
            session.add(Question(**question_data.__dict__))
    session.commit()
