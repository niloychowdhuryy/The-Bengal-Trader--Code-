---
name: mobile-game-ui
description: "Use when designing, implementing, or reviewing The Bengal Trader's mobile interface, screens, navigation, controls, or responsive layouts."
---

# Mobile Game UI

Create a mobile-first interface that is comfortable to use in portrait orientation and easy to understand at a glance.

## Workflow

1. Inspect the current screen, navigation patterns, design components, and supported device sizes before changing the interface.
2. Identify the screen's primary player goal and make one main action visually obvious. Keep secondary actions clearly subordinate.
3. Arrange content for a narrow portrait viewport first; then check that it adapts cleanly to wider screens without breaking hierarchy or controls.
4. Use plain, concise language, readable text, clear labels, and familiar navigation. Keep touch targets comfortably large and separated, especially for frequent or consequential actions.
5. Show only information needed for the current decision. Reveal details progressively instead of packing the screen into a dashboard or nested menu.
6. Check empty, loading, error, and confirmation states, along with long text and small-screen behavior. Reuse existing components and visual conventions.

## Requirements and restrictions

- Prioritise portrait use, touch interaction, legibility, and a clear route back or onward.
- Keep navigation shallow and menus minimal. Group related actions using familiar labels.
- Provide clear feedback after an action and confirmation for consequential or irreversible choices.
- Do not rely on tiny controls, hover-only interactions, dense tables, unexplained icons, or color alone to convey meaning.
- Never create unnecessarily complicated dashboards. If multiple decisions compete for attention, simplify or separate them into focused steps.

## Review checklist

- [ ] Is the screen usable and legible on a narrow portrait display?
- [ ] Is there one obvious main action and a clear navigation path?
- [ ] Are labels simple, text readable, and touch targets easy to hit?
- [ ] Is unnecessary information, menu depth, and dashboard complexity removed?
- [ ] Are action feedback and important states handled?
