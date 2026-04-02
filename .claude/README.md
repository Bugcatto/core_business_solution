# .claude Configuration

This directory contains all agent definitions, shared rules, commands, and docs for the Multi-Industry POS Platform project.

---

## Directory Structure

```
.claude/
  agents/          Agent definitions (invoked as subagents by product-manager)
  rules/           Shared rule files referenced by all agents
  commands/        Slash commands for common workflows
  docs/            Persistent project state (master log, decisions)
  README.md        This file
```

---

## Agents

| Agent | Role | Model | Can Edit |
|-------|------|-------|----------|
| product-manager | Orchestrator — assigns tasks, owns roadmap | sonnet | Yes + Agent tool |
| solution-architect | Architecture reviewer — gates technical decisions | opus | Yes |
| backend-engineer | NestJS / TypeORM / PostgreSQL implementation | sonnet | Yes |
| frontend-engineer | Vue 3 / Quasar / Pinia implementation | sonnet | Yes |
| qa-engineer | Test writing, acceptance validation | sonnet | Yes |
| data-architect | Schema design, migrations, data modelling | sonnet | Yes |
| devops-engineer | GCP / Docker / CI-CD infrastructure | sonnet | Yes |
| security-engineer | Auth, RBAC, vulnerability review (read-only) | sonnet | Read only |
| mobile-engineer | Flutter offline POS (Phase 4) | sonnet | Yes |
| ux-designer | Screen design, onboarding UX (read-only) | sonnet | Read only |

Only **product-manager** has the `Agent` tool and may invoke other agents.

---

## Rules

| File | Purpose |
|------|---------|
| `rules/collaboration.md` | Team structure, authority, execution behavior, output format |
| `rules/mvp-delivery.md` | MVP scope, definition of done, out-of-scope items |

All agents reference both rule files via:
```
## Rules & Standards
> Collaboration: collaboration.md
> MVP Mode: mvp-delivery.md
```

---

## Commands

| Command | Invocation | Purpose |
|---------|-----------|---------|
| Orchestrate MVP | `/orchestrate-mvp` | Full MVP execution loop via product-manager |
| Assess Progress | `/assess-progress` | Codebase assessment + progress log update |
| MVP Progress Log | `/mvp-progress-log` | View the progress log template structure |

Slash commands load the prompt from `commands/<name>.md` and pass it to the appropriate agent.

---

## Docs

| File | Purpose |
|------|---------|
| `docs/mvp-progress.md` | Live MVP master log — updated by product-manager after each cycle |

---

## Output Format

Every agent response must end with:

```
### Summary
### Output
### Assumptions
### Risks
### Work Log
- Task / Status / Deliverables / Next Suggested Step
```

See `rules/collaboration.md` for the full spec.
