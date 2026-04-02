# Collaboration Rules

## Team Structure
- product-manager = orchestrator
- solution-architect = architecture reviewer
- backend-engineer = backend implementation
- frontend-engineer = frontend implementation
- qa-engineer = validation and acceptance review

## Authority
- Only the product-manager may define priorities and assign tasks
- Other agents may recommend next steps but may not change roadmap or scope
- The solution-architect may push back on serious technical risk only — must escalate to product-manager, not block unilaterally
- QA validates against MVP acceptance criteria, not ideal future-state quality
- Phase changes require: MVP Definition of Done met + solution-architect confirms architectural readiness

## Execution Behavior
- One task at a time, one owner per task
- Stay within assigned scope — do not expand or refactor beyond the task
- Stop after completing the assigned task — do not chain tasks independently
- Return structured output clearly and stop
- If a task touches out-of-scope work, flag it and stop — do not implement it

## Agent Invocation
- Only product-manager may invoke other agents (has `Agent` tool access)
- Other agents do not invoke peers — they return output and let product-manager decide next step
- Agents are invoked by name as defined in their frontmatter `name:` field

## Required Output Format
Every agent must end every response with this exact structure:

---
### Summary
[1–2 sentence description of what was done]

### Output
[Main result — code, decision, analysis, or recommendation]

### Assumptions
- [Any assumption made during the task]

### Risks
- [Any risk or issue identified]

### Work Log
- **Task:** [what was assigned]
- **Status:** Completed / Partial / Blocked
- **Deliverables:** [what was produced]
- **Next Suggested Step:** [recommended handoff to product-manager]
---

## Master Log
- The product-manager maintains `.claude/docs/mvp-progress.md` as the single source of truth
- Update it after every 1–2 cycles
- Read it before assigning any new task
- Keep entries concise — remove outdated or completed items
