# POS Awesome Phase 2 Cleanup Design

Date: 2026-04-24

## Goal

Run the next cleanup phase with a safe, low-risk scope focused on:

1. Backend offline-sync helper deduplication
2. Frontend type consolidation for already-confirmed runtime shapes

This phase must not change POS behavior in billing, pricing, taxes, discounts, printing, or offline queue semantics.

## Scope

### Included

- Extract duplicated pure helper logic from `posawesome/posawesome/api/offline_sync/*` into one shared helper module.
- Additive frontend type improvements in `frontend/src/posapp/types/` and nearby safe call sites.
- Small, localized store/type fixes only if required for correctness and lower-risk than preserving the inconsistency.
- Targeted tests and compile/build verification.

### Excluded

- Pricing, tax, discount, total, redemption, or return-flow logic changes.
- Printing/QZ Tray behavior changes.
- Offline write-queue payload or replay semantics.
- Broad API-boundary retyping across the app.
- Large architecture refactors or cross-cutting store redesign.

## Backend Design

### Problem

The offline-sync resource modules duplicate a small shared set of pure request-shaping and response-shaping helpers:

- `_normalize_timestamp`
- `_max_timestamp`
- `_build_response`
- `_resolve_profile`

These helpers are repeated across:

- `customers.py`
- `items.py`
- `stock.py`
- `bootstrap.py`
- `currencies.py`
- `payment_methods.py`

This duplication increases drift risk without adding domain-specific value.

### Proposed Change

Create a shared helper module under:

- `posawesome/posawesome/api/offline_sync/common.py`

Move only behavior-identical, pure helper logic into that module.

Do not extract helper variants that differ by defaults or resource-specific semantics, including:

- module-specific `_coerce_limit`
- selective `_should_include` helpers

Resource modules will continue to own:

- endpoint names
- whitelisted functions
- resource-specific filtering
- ERPNext/Frappe queries
- response row shaping

### Backend Safety Rules

- Preserve current endpoint names and payload contracts exactly.
- Do not change sync schema versions.
- Do not change resource-specific filtering semantics.
- Do not merge near-identical helpers if one copy has broader/narrower behavior.
- Keep diffs mechanical and easy to compare per file.

### Backend Rollout Order

1. Introduce `common.py`
2. Migrate one or two modules first
3. Migrate remaining modules
4. Re-run Python syntax compile on touched files

## Frontend Design

### Problem

Several shared POS domain types still mix full-document and partial-reference semantics.

The main remaining mismatch is invoice typing:

- `InvoiceDoc` represents a full invoice document
- `invoiceStore` intentionally stores partial stubs such as `{ name, doctype }`

There is also remaining value in introducing additive customer summary/detail/cache DTOs where the same `Customer` symbol currently covers multiple shapes.

This causes:

- repeated inline object typing
- excess `any`
- hidden mismatch between store/runtime shapes and declared contracts

### Proposed Change

Use an additive, layered type strategy:

1. Split full-document types from partial-reference/store DTOs where runtime behavior already proves that distinction.
2. Add small DTO/helper types for summary/store/transport shapes instead of forcing one type to represent every variant.
3. Update only high-confidence consumers in this phase.

### Targeted Frontend Type Work

#### Additive DTO/helper types

Introduce small shared types for:

- invoice document references / partial stubs
- partial invoice store shapes distinct from full invoice documents
- customer summary/cache/detail variants

These should live either in:

- `frontend/src/posapp/types/models.ts`, or
- a closely-related `types/` module if separation is cleaner

The choice should prioritize minimal churn.

#### Safe caller updates

Prefer updating only these kinds of callers:

- invoice store normalization helpers
- invoice-adjacent store/load flows
- customer store normalization/helpers where shapes are already explicit
- places where current code already enforces a stable runtime shape

### Frontend Safety Rules

- Preserve raw `unknown` or loose boundary typing at Frappe transport edges where decoding has not happened yet.
- Preserve custom-field escape hatches via index signatures where needed.
- Avoid mass-updating unrelated components just to “use the new types everywhere.”
- Do not force-merge `stock_qty` and `actual_qty` semantics.

## Implementation Plan

### Step 1: Backend helper extraction

- Inspect each offline-sync helper copy side-by-side.
- Extract only identical helpers.
- Import shared helpers back into each module.
- Keep module-local helpers where behavior differs.

### Step 2: Frontend shared type additions

- Add invoice reference / partial invoice types.
- Add customer summary/detail/cache DTOs where they reduce shape ambiguity.
- Update the narrow set of safe consumers.

### Step 3: Minimal store contract adjustment if required

If compilation or correctness requires it, allow one localized store-facing type split such as:

- `InvoiceDocRef`
- `PartialInvoiceDoc`

But only if:

- the change is localized
- it reduces unsoundness
- it does not trigger broad downstream churn

## Verification

### Required

- `yarn.cmd --cwd frontend type-check`
- `yarn.cmd --cwd frontend build`
- targeted frontend Vitest runs for touched areas
- `python -m py_compile` for touched backend files

### Informational

- repo-wide ESLint may remain noisy because of pre-existing issues
- touched-file lint should pass for modified frontend files

## Risks

### Low

- mechanical helper extraction in offline-sync modules
- additive type widening for fields already used at runtime
- localized runtime payload typing

### Medium

- invoice/customer DTO splits if store contracts leak widely
- partial store contract cleanup that touches many call sites

### High / Out of Scope

- queue payload redesign
- billing or payment-flow refactors
- printing or device service boundary refactors
- semantic stock-field consolidation without backend proof

## Success Criteria

- Fewer duplicated offline-sync helpers with identical behavior preserved
- Shared frontend types better reflect actual runtime usage
- No POS billing, pricing, printing, or offline submission regressions
- Full compile/build verification remains green
