# AdaptIQ

AdaptIQ is a frontend prototype for an adaptive learning and Socratic assessment platform. It includes topic selection, quiz questions, streamed mock hints, and a mastery dashboard.

The quiz currently uses mock data. The typed API layer in `src/services/api.ts` is prepared for a FastAPI backend at `http://localhost:8000/api`; backend endpoints are not implemented in this project yet.

## Requirements

- Node.js
- Bun

## Development

```sh
bun install
bun run dev
```

## Checks

```sh
bun run lint
bun run test
bun run build
```

## Connecting a backend

The API base URL and mock-mode switch are defined in `src/services/api.ts`. Implement the corresponding backend endpoints, then switch mock mode off when the API is ready.
