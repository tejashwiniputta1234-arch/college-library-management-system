---
name: Library storage choice
description: Why this Replit library app uses PostgreSQL persistence instead of a separate MongoDB service
---

The app uses the workspace-provisioned PostgreSQL database with Drizzle rather than MongoDB.

**Why:** The Replit project already provides a managed PostgreSQL connection and no MongoDB integration or connection string is available, so PostgreSQL keeps the app runnable without asking the user for external credentials.

**How to apply:** Keep future schema and API changes in the existing Drizzle/OpenAPI flow unless the user explicitly supplies and requests an external MongoDB setup.