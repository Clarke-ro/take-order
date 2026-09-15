---
name: Live accessibility checks
description: The workspace can run browser-level accessibility-tree assertions with the preinstalled Chromium binary and CDP.
---

Use Chromium's headless CDP Accessibility domain when a test must verify the live accessibility tree rather than serialized React markup. This avoids adding a browser automation dependency for focused checks.

**Why:** Markup assertions can miss the roles, accessible names, and state values that Chromium actually exposes to assistive technology.

**How to apply:** Keep the browser fixture isolated with a temporary profile and cleanly wait for the Chromium process to exit before removing its profile directory.

Chromium can leave profile files briefly after its process is killed, especially when multiple accessibility checks run in one test process. Use retrying recursive cleanup after waiting for the exit event so one slow profile teardown does not fail an otherwise valid check.