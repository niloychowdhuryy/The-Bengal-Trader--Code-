---
name: game-design
description: "Use when designing or changing The Bengal Trader's gameplay, progression, economy, trading, ships, combat, reputation, dynasty, or historical events."
---

# Game Design

Design and implement gameplay that feels like one coherent, approachable strategy game. Keep the rules understandable to a 12-year-old without removing meaningful choices.

## Workflow

1. Inspect the existing design, implementation, and related content before proposing or changing a mechanic. Treat established behavior and terminology as the source of truth; identify conflicts rather than silently inventing new rules.
2. Trace how the change affects the full gameplay loop: journey and trade, resource and money flows, progression, ship upgrades, combat, reputation, dynasty, and historical events. Update connected systems consistently.
3. Make player goals, costs, risks, rewards, and outcomes explicit. Prefer a small number of legible choices with strategic trade-offs over hidden rules, needless currencies, or excessive bookkeeping.
4. Preserve balance across early, middle, and late progression. Check that prices, rewards, upgrade effects, combat difficulty, and reputation consequences do not create dominant exploits or dead ends.
5. Explain new rules in plain language in the UI or relevant game content. Keep historical events distinguishable from ordinary game events and ensure they fit the game's timeline and systems.
6. Add or update tests, data, and documentation that directly cover the change.

## Requirements and restrictions

- Keep all mechanics consistent with the game's established setting, terminology, and player-facing explanations.
- Ensure that money, cargo, risks, and rewards have understandable sources and sinks; upgrades and progression should offer clear benefits and costs.
- Treat combat, reputation, and dynasty choices as connected systems, not isolated bonuses.
- Do not add complexity merely to simulate realism. Preserve depth through readable trade-offs and consequences.
- Do not promise historical accuracy for fictionalised mechanics or events.

## Review checklist

- [ ] Can a 12-year-old explain the goal, cost, risk, and result of the mechanic?
- [ ] Does it fit the existing gameplay loop and progression?
- [ ] Are economy, ship, combat, reputation, dynasty, and event effects balanced and consistent?
- [ ] Are edge cases and relevant player-facing explanations covered?
- [ ] Are related tests or documentation updated?
