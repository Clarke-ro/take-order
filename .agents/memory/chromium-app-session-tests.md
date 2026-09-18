---
name: Chromium app-session tests
description: Environment constraint for full-page Chromium regression tests in the Duka workspace.
---

Full-page Chromium tests should launch the Vite entrypoint with the test runner's absolute Node executable and derive the artifact directory from the current working directory.

**Why:** Child-process lookup of package-manager and shell commands is unreliable in this test environment, while the absolute Node/Vite process starts and cleans up consistently.

**How to apply:** Use a temporary free port, a temporary Chromium profile, and CDP `Page.addScriptToEvaluateOnNewDocument` for deterministic API responses before navigating or reloading the real app. Run the CDP check as a direct `tsx` script rather than through Node's test harness; Node 24 can hit an async-scope assertion while tearing down a WebSocket-backed Chromium session. For grouped radio choices, assert the checked values rather than the full input list, and wait on stable step headings when a card intentionally hides its action.