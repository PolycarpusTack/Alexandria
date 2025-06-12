# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Alexandria Platform. ADRs document important architectural decisions made during the development of the system.

## ADR Format

Each ADR follows this structure:
- **Title**: Brief description of the decision
- **Status**: Proposed, Accepted, Deprecated, or Superseded
- **Context**: Background and problem being solved
- **Decision**: What was decided and why
- **Consequences**: Implications of the decision

## ADR Index

| Number | Title | Status | Date |
|--------|-------|--------|------|
| [ADR-001](./001-microkernel-plugin-architecture.md) | Microkernel Plugin Architecture | Accepted | 2025-01-11 |
| [ADR-002](./002-api-versioning-strategy.md) | API Versioning Strategy | Accepted | 2025-01-11 |
| [ADR-003](./003-state-management-with-zustand.md) | State Management with Zustand | Accepted | 2025-01-11 |
| [ADR-004](./004-shared-component-library.md) | Shared Component Library | Accepted | 2025-01-11 |
| [ADR-005](./005-unified-design-system.md) | Unified Design System | Accepted | 2025-01-11 |
| [ADR-006](./006-python-typescript-hybrid.md) | Python-TypeScript Hybrid Architecture | Accepted | 2025-01-11 |
| [ADR-007](./007-build-process-standardization.md) | Build Process Standardization | Accepted | 2025-01-11 |

## Creating New ADRs

When creating a new ADR:

1. Use the next available number (e.g., ADR-008)
2. Follow the format template in `template.md`
3. Update this README with the new ADR entry
4. Get team review before marking as "Accepted"

## ADR Lifecycle

- **Proposed**: ADR is draft and under discussion
- **Accepted**: ADR has been approved and is being implemented
- **Deprecated**: ADR is no longer relevant but kept for historical reference
- **Superseded**: ADR has been replaced by a newer ADR (reference the replacement)