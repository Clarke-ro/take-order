---
name: Duka build environment
description: Environment variables required when building the Duka Vite artifact outside its managed workflow.
---

The Duka Vite configuration requires both `PORT` and `BASE_PATH` even for a standalone production build.

**Why:** The managed artifact workflow supplies these values automatically, but direct package build commands do not.

**How to apply:** When running the package build manually, provide the workflow-equivalent port and the artifact root base path rather than treating a missing-variable error as an application failure.