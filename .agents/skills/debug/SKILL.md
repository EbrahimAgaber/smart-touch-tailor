---
name: debug
description: Deep Rationalization & Cause Verification
---

## Skill: `/debug` — Deep Rationalization & Cause Verification

When the user invokes `/debug [error message / buggy behavior]`, execute the following sequential diagnostic loop:

### 1. Chain-of-Thought Rationalization (`<thinking>`)
Before modifying any files, open an internal reasoning block. Document your hypothesis:
* What is the symptom?
* What are 3 distinct technical reasons this error could manifest in this specific stack?
* What structural patterns, lifecycle issues, or race conditions might be hidden here?

### 2. Codebase Inspection
* Use terminal/file tools to inspect relevant controllers, routers, schema files, or frontend components.
* Verify your hypotheses against the actual codebase state to find the smoking gun.

### 3. Verification & Root Cause Isolation
* State clearly: `"Root Cause Isolated: [Detailed explanation of why the bug happens, not just where it happens]."`

### 4. Surgical Fix
* Implement the targeted, clean refactor required to solve the root cause. Do not rewrite unrelated components or introduce code bloat.
* Double-check that fixing this issue doesn't break adjacent modules.
