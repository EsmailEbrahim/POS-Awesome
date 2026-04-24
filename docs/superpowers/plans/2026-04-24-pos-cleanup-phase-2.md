# POS Cleanup Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely deduplicate backend offline-sync helper plumbing and consolidate the remaining high-value frontend POS DTO/store-reference types without changing billing, pricing, printing, or offline queue behavior.

**Architecture:** Backend work extracts only behavior-identical offline-sync helper functions into a shared `common.py` module and leaves each whitelisted resource endpoint in place. Frontend work introduces additive invoice/customer reference DTOs and updates only the narrow store/helper call sites that are provably mismatched today.

**Tech Stack:** Python + Frappe backend, Vue 3 + Pinia + TypeScript frontend, Vitest, Vite, `py_compile`

---

## File Map

### Backend
- Create: `posawesome/posawesome/api/offline_sync/common.py`
- Modify: `posawesome/posawesome/api/offline_sync/customers.py`
- Modify: `posawesome/posawesome/api/offline_sync/items.py`
- Modify: `posawesome/posawesome/api/offline_sync/stock.py`
- Modify: `posawesome/posawesome/api/offline_sync/bootstrap.py`
- Modify: `posawesome/posawesome/api/offline_sync/currencies.py`
- Modify: `posawesome/posawesome/api/offline_sync/payment_methods.py`
- Test: `posawesome/posawesome/api/test_offline_sync_customers.py`
- Test: `posawesome/posawesome/api/test_offline_sync_items.py`
- Test: `posawesome/posawesome/api/test_offline_sync_stock.py`
- Test: `posawesome/posawesome/api/test_offline_sync_bootstrap.py`
- Test: `posawesome/posawesome/api/test_offline_sync_currencies.py`
- Test: `posawesome/posawesome/api/test_offline_sync_payment_methods.py`

### Frontend
- Modify: `frontend/src/posapp/types/models.ts`
- Modify: `frontend/src/posapp/stores/invoiceStore.ts`
- Modify: `frontend/src/posapp/stores/customersStore.ts`
- Test: `frontend/tests/invoiceStore.spec.ts`
- Test: `frontend/tests/invoiceCustomerSync.spec.ts`
- Optional create: `frontend/tests/customersStore.spec.ts` if no existing coverage fits the customer-shape assertions

## Chunk 1: Backend Offline Sync Helper Dedup

### Task 1: Lock current duplicated helper behavior with tests

**Files:**
- Modify: `posawesome/posawesome/api/test_offline_sync_customers.py`
- Modify: `posawesome/posawesome/api/test_offline_sync_items.py`
- Modify: `posawesome/posawesome/api/test_offline_sync_stock.py`
- Modify: `posawesome/posawesome/api/test_offline_sync_bootstrap.py`
- Modify: `posawesome/posawesome/api/test_offline_sync_currencies.py`
- Modify: `posawesome/posawesome/api/test_offline_sync_payment_methods.py`

- [ ] **Step 1: Add/extend assertions around helper-driven behavior**

```python
self.assertEqual(response["schema_version"], self.module.SYNC_SCHEMA_VERSION)
self.assertIn("next_watermark", response)
self.assertIn("has_more", response)
```

- [ ] **Step 2: Run the smallest backend regression slice**

Run:
```bash
python posawesome/posawesome/api/test_offline_sync_customers.py
python posawesome/posawesome/api/test_offline_sync_items.py
python posawesome/posawesome/api/test_offline_sync_stock.py
python posawesome/posawesome/api/test_offline_sync_bootstrap.py
python posawesome/posawesome/api/test_offline_sync_currencies.py
python posawesome/posawesome/api/test_offline_sync_payment_methods.py
```

Expected:
- PASS
- Current helper-driven response shape is locked before extraction

- [ ] **Step 3: Add one `_resolve_profile` regression where a string profile name resolves through `get_cached_doc`**

```python
response = self.module.sync_customers(pos_profile="POS-TEST", watermark=None, limit=1)
self.assertEqual(response["changes"][0]["key"], "customer::CUST-001")
```

- [ ] **Step 4: Re-run the targeted backend tests**

Run:
```bash
python posawesome/posawesome/api/test_offline_sync_customers.py
python posawesome/posawesome/api/test_offline_sync_items.py
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add posawesome/posawesome/api/test_offline_sync_*.py
git commit -m "test: lock offline sync helper behavior"
```

### Task 2: Extract only identical helpers into `common.py`

**Files:**
- Create: `posawesome/posawesome/api/offline_sync/common.py`

- [ ] **Step 1: Write the failing helper test scaffold or import smoke check**

- [ ] **Step 1: Add one helper-behavior assertion to an existing offline-sync test file using the already-loaded module**

```python
self.assertEqual(
    self.module._normalize_timestamp(" 2026-04-09T10:05:00 "),
    "2026-04-09T10:05:00",
)
```

- [ ] **Step 2: Create the shared helper module**

```python
import json
import frappe

def _normalize_timestamp(value):
    text = str(value or "").strip()
    return text or None

def _max_timestamp(*values):
    ...

def _build_response(changes=None, deleted=None, next_watermark=None, has_more=False, full_resync_required=False):
    ...

def _resolve_profile(pos_profile=None):
    ...
```

- [ ] **Step 3: Compile the new helper module**

Run:
```bash
python -m py_compile posawesome/posawesome/api/offline_sync/common.py
```

Expected:
- PASS

- [ ] **Step 4: Commit**

```bash
git add posawesome/posawesome/api/offline_sync/common.py
git commit -m "refactor: add shared offline sync helpers"
```

### Task 3: Migrate customer/item/stock sync modules to shared helpers

**Files:**
- Modify: `posawesome/posawesome/api/offline_sync/customers.py`
- Modify: `posawesome/posawesome/api/offline_sync/items.py`
- Modify: `posawesome/posawesome/api/offline_sync/stock.py`
- Test: `posawesome/posawesome/api/test_offline_sync_customers.py`
- Test: `posawesome/posawesome/api/test_offline_sync_items.py`
- Test: `posawesome/posawesome/api/test_offline_sync_stock.py`

- [ ] **Step 1: Replace local copies of identical helpers with imports**

```python
from posawesome.posawesome.api.offline_sync.common import (
    _build_response,
    _max_timestamp,
    _normalize_timestamp,
    _resolve_profile,
)
```

- [ ] **Step 2: Keep module-local helpers that are not identical**

```python
def _coerce_limit(...):
    ...
```

- [ ] **Step 3: Run targeted backend regressions**

Run:
```bash
python posawesome/posawesome/api/test_offline_sync_customers.py
python posawesome/posawesome/api/test_offline_sync_items.py
python posawesome/posawesome/api/test_offline_sync_stock.py
python -m py_compile posawesome/posawesome/api/offline_sync/customers.py posawesome/posawesome/api/offline_sync/items.py posawesome/posawesome/api/offline_sync/stock.py
```

Expected:
- PASS

- [ ] **Step 4: Commit**

```bash
git add posawesome/posawesome/api/offline_sync/customers.py posawesome/posawesome/api/offline_sync/items.py posawesome/posawesome/api/offline_sync/stock.py
git commit -m "refactor: share offline sync helpers in customer item stock sync"
```

### Task 4: Migrate bootstrap/currencies/payment-method sync modules to shared helpers

**Files:**
- Modify: `posawesome/posawesome/api/offline_sync/bootstrap.py`
- Modify: `posawesome/posawesome/api/offline_sync/currencies.py`
- Modify: `posawesome/posawesome/api/offline_sync/payment_methods.py`
- Test: `posawesome/posawesome/api/test_offline_sync_bootstrap.py`
- Test: `posawesome/posawesome/api/test_offline_sync_currencies.py`
- Test: `posawesome/posawesome/api/test_offline_sync_payment_methods.py`

- [ ] **Step 1: Import only the identical helpers**

```python
from posawesome.posawesome.api.offline_sync.common import (
    _build_response,
    _max_timestamp,
    _normalize_timestamp,
    _resolve_profile,
)
```

- [ ] **Step 2: Leave `_should_include` and varying `_coerce_limit` logic local where they differ**

```python
def _should_include(...):
    ...
```

- [ ] **Step 3: Run targeted backend regressions**

Run:
```bash
python posawesome/posawesome/api/test_offline_sync_bootstrap.py
python posawesome/posawesome/api/test_offline_sync_currencies.py
python posawesome/posawesome/api/test_offline_sync_payment_methods.py
python -m py_compile posawesome/posawesome/api/offline_sync/bootstrap.py posawesome/posawesome/api/offline_sync/currencies.py posawesome/posawesome/api/offline_sync/payment_methods.py
```

Expected:
- PASS

- [ ] **Step 4: Commit**

```bash
git add posawesome/posawesome/api/offline_sync/bootstrap.py posawesome/posawesome/api/offline_sync/currencies.py posawesome/posawesome/api/offline_sync/payment_methods.py
git commit -m "refactor: share offline sync helpers in bootstrap currency payment sync"
```

## Chunk 2: Frontend Invoice and Customer Type Consolidation

### Task 5: Add invoice reference / partial invoice types

**Files:**
- Modify: `frontend/src/posapp/types/models.ts`
- Test: `frontend/tests/invoiceStore.spec.ts`

- [ ] **Step 1: Add the failing type-oriented test coverage around invoice stubs**

```ts
it("normalizes a string invoice name into a minimal invoice reference", () => {
  const store = useInvoiceStore();
  store.setInvoiceDoc("ACC-PSINV-2026-0001");
  expect(store.invoiceDoc).toEqual({
    name: "ACC-PSINV-2026-0001",
    doctype: "POS Invoice",
  });
});
```

- [ ] **Step 2: Run the invoice store test**

Run:
```bash
yarn.cmd --cwd frontend test --run tests/invoiceStore.spec.ts
```

Expected:
- PASS with the existing runtime behavior still documented by the test

- [ ] **Step 3: Add additive shared types for invoice references**

```ts
export interface InvoiceDocRef {
  name?: string;
  doctype?: string;
}

export type PartialInvoiceDoc = Partial<InvoiceDoc> & InvoiceDocRef;
```

- [ ] **Step 4: Use the new partial/reference type in the store normalization path**

```ts
const normalizeDoc = (doc: unknown): PartialInvoiceDoc | null => { ... }
const setInvoiceDoc = (doc: PartialInvoiceDoc | string | null | undefined) => { ... }
```

- [ ] **Step 5: Re-run targeted frontend verification**

Run:
```bash
yarn.cmd --cwd frontend test --run tests/invoiceStore.spec.ts
yarn.cmd --cwd frontend type-check
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/posapp/types/models.ts frontend/src/posapp/stores/invoiceStore.ts frontend/tests/invoiceStore.spec.ts
git commit -m "refactor: split invoice doc references from full invoice types"
```

### Task 6: Add customer summary/detail/cache DTOs

**Files:**
- Modify: `frontend/src/posapp/types/models.ts`
- Modify: `frontend/src/posapp/stores/customersStore.ts`
- Test: `frontend/tests/invoiceCustomerSync.spec.ts`
- Optional create: `frontend/tests/customersStore.spec.ts`

- [ ] **Step 1: Add or extend a focused test around customer profile normalization through the public store API**

```ts
store.setPosProfile({ pos_profile: "Main POS" } as any);
expect(store.posProfile?.name).toBe("Main POS");
```

- [ ] **Step 2: Add additive shared customer DTOs**

```ts
export interface CustomerSummary {
  name: string;
  customer_name: string;
  mobile_no?: string;
  email_id?: string;
  primary_address?: string;
}

export interface StoredCustomer extends CustomerSummary {
  tax_id?: string;
}

export type CustomerInfo = Record<string, unknown>;
```

- [ ] **Step 3: Update only the safe customer store touchpoints**

```ts
const customers = ref<CustomerSummary[]>([]);
const customerInfo = ref<Record<string, unknown>>({});
function normalizeProfile(profile: unknown): POSProfile | null { ... }
```

- [ ] **Step 4: Run targeted verification**

Run:
```bash
yarn.cmd --cwd frontend test --run tests/invoiceCustomerSync.spec.ts
yarn.cmd --cwd frontend type-check
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/posapp/types/models.ts frontend/src/posapp/stores/customersStore.ts frontend/tests/invoiceCustomerSync.spec.ts
git commit -m "refactor: add customer summary and stored customer types"
```

### Task 7: Final integrated verification

**Files:**
- Modify: none expected unless verification finds a small fix

- [ ] **Step 1: Run targeted backend checks**

Run:
```bash
python posawesome/posawesome/api/test_offline_sync_customers.py
python posawesome/posawesome/api/test_offline_sync_items.py
python posawesome/posawesome/api/test_offline_sync_stock.py
python posawesome/posawesome/api/test_offline_sync_bootstrap.py
python posawesome/posawesome/api/test_offline_sync_currencies.py
python posawesome/posawesome/api/test_offline_sync_payment_methods.py
python -m py_compile posawesome/posawesome/api/offline_sync/common.py posawesome/posawesome/api/offline_sync/customers.py posawesome/posawesome/api/offline_sync/items.py posawesome/posawesome/api/offline_sync/stock.py posawesome/posawesome/api/offline_sync/bootstrap.py posawesome/posawesome/api/offline_sync/currencies.py posawesome/posawesome/api/offline_sync/payment_methods.py
```

Expected:
- PASS

- [ ] **Step 2: Run targeted frontend checks**

Run:
```bash
yarn.cmd --cwd frontend test --run tests/invoiceStore.spec.ts tests/invoiceCustomerSync.spec.ts tests/sw-updater.spec.ts
yarn.cmd --cwd frontend type-check
yarn.cmd --cwd frontend build
```

Expected:
- PASS

- [ ] **Step 3: Run touched-file lint only**

Run:
```bash
yarn.cmd --cwd frontend eslint src/posapp/types/models.ts src/posapp/stores/invoiceStore.ts src/posapp/stores/customersStore.ts tests/invoiceStore.spec.ts tests/invoiceCustomerSync.spec.ts --ext .ts
```

Expected:
- PASS

- [ ] **Step 4: Final commit**

```bash
git add posawesome/posawesome/api/offline_sync/common.py posawesome/posawesome/api/offline_sync/customers.py posawesome/posawesome/api/offline_sync/items.py posawesome/posawesome/api/offline_sync/stock.py posawesome/posawesome/api/offline_sync/bootstrap.py posawesome/posawesome/api/offline_sync/currencies.py posawesome/posawesome/api/offline_sync/payment_methods.py posawesome/posawesome/api/test_offline_sync_customers.py posawesome/posawesome/api/test_offline_sync_items.py posawesome/posawesome/api/test_offline_sync_stock.py posawesome/posawesome/api/test_offline_sync_bootstrap.py posawesome/posawesome/api/test_offline_sync_currencies.py posawesome/posawesome/api/test_offline_sync_payment_methods.py frontend/src/posapp/types/models.ts frontend/src/posapp/stores/invoiceStore.ts frontend/src/posapp/stores/customersStore.ts frontend/tests/invoiceStore.spec.ts frontend/tests/invoiceCustomerSync.spec.ts
git commit -m "refactor: clean offline sync helpers and invoice customer DTOs"
```
