# Vercel services

Proposed service names and exposure require confirmation before deployment.

| Service | Root | Purpose | Public routes |
| --- | --- | --- | --- |
| app | . | Next.js dashboards and TypeScript API routes | All paths except /api/py/* |
| api | . | FastAPI, waste analysis, SpacetimeDB reads | /api/py/* |
| scripts | app/api | HTTP adapter for recommendation generation | Internal only |

The api service uses the repository root because it imports the root recommender,
database.json, and the api package. Its installCommand uses api/requirements.txt
to avoid installing camera/YOLO packages. The scripts service wraps the existing
recommendation worker; scripts/ contains command-line jobs and is not a server.

## Bindings

The calling app service declares two bindings:

- app -> api: WASTE_API_URL
- app -> scripts: RECOMMENDER_URL

Vercel injects these URLs. Do not configure them manually in project settings.
Only server route handlers read them. Next.js menu, chat, Grok, and recommendation
routes retain their existing public paths. FastAPI receives /api/py/* unchanged.
/docs and /openapi.json redirect to the corresponding FastAPI paths.

## Environment variables

Set SPACETIMEDB_HOST and SPACETIMEDB_DATABASE in Vercel project settings.
Supply SPACETIMEDB_TOKEN only if database access needs an authorized token.
Configure GEMINI_API_KEY and XAI_API_KEY if using the corresponding chat routes.
Keep secrets out of NEXT_PUBLIC variables and source control.

The deployed recommendation service uses the existing rule-based fallback;
it does not install or host Ollama. Camera capture and queue workers remain local.
Menu scraper scripts update local files and are not deployed as an HTTP service.

## Local development

Run `npx vercel dev` from the repository root to start the services with bindings.
The app service uses npm run next-dev rather than the old combined npm run dev.
For direct Next.js + FastAPI development, DEMO_FASTAPI_URL remains an optional
fallback for the waste API. Recommendation generation needs vercel dev bindings.

Deployment and runtime testing have not been performed. Review the service names,
public routes, and bindings before publishing.
