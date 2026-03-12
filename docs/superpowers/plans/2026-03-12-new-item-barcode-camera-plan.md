# New Item Barcode Camera Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow POS users to enter a barcode while creating a new item and optionally fill it via camera scanning when the POS Profile enables camera scanning.

**Architecture:** Extend the existing POS new-item dialog instead of adding a new backend endpoint. Keep item creation on the current `frappe.client.insert` path, append an `Item.barcodes` child row when a barcode is provided, and bridge the dialog to the already-mounted scanner flow in the item selector.

**Tech Stack:** Vue 3, Vuetify 3, Vitest, Vue Test Utils, Frappe client API

---

## Chunk 1: Dialog Behavior

### Task 1: Add a failing regression test for the new item dialog

**Files:**
- Create: `frontend/tests/newItemDialog.spec.ts`
- Modify: `frontend/src/posapp/components/pos/items/NewItemDialog.vue`

- [ ] **Step 1: Write the failing test**

Cover these behaviors:
- barcode input renders
- camera button is hidden when camera scanning is disabled
- camera button is visible when enabled
- invoking the camera callback fills the barcode field
- submit sends barcode data through the service payload

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; cmd /c npx vitest run tests/newItemDialog.spec.ts`
Expected: FAIL because the dialog does not yet render barcode controls or send barcode payloads.

- [ ] **Step 3: Write minimal implementation**

Update the dialog to:
- accept a `cameraEnabled` flag
- accept a callback for opening the shared scanner flow
- render a barcode field
- populate barcode from scanner callback
- send `barcode` to `itemService.createItem`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; cmd /c npx vitest run tests/newItemDialog.spec.ts`
Expected: PASS

## Chunk 2: Selector Integration

### Task 2: Connect the dialog to the existing scanner flow

**Files:**
- Modify: `frontend/src/posapp/components/pos/items/ItemsSelector.vue`

- [ ] **Step 1: Add a failing integration assertion if needed**

If the dialog test cannot cover scanner wiring cleanly, add a small integration test or extend the same spec with a wrapper component.

- [ ] **Step 2: Run targeted test to verify it fails**

Run: `cd frontend; cmd /c npx vitest run tests/newItemDialog.spec.ts`
Expected: FAIL on scanner-triggered barcode fill until selector wiring exists.

- [ ] **Step 3: Write minimal implementation**

Pass camera-enabled state from `pos_profile.posa_enable_camera_scanning` and route scanner results into the open dialog without changing unrelated scanner behavior.

- [ ] **Step 4: Run targeted test to verify it passes**

Run: `cd frontend; cmd /c npx vitest run tests/newItemDialog.spec.ts`
Expected: PASS

## Chunk 3: Service Payload

### Task 3: Persist barcode in the created Item document

**Files:**
- Modify: `frontend/src/posapp/services/itemService.ts`
- Test: `frontend/tests/newItemDialog.spec.ts`

- [ ] **Step 1: Add a failing payload assertion**

Assert that `createItem` sends `barcodes: [{ barcode }]` when barcode is present and omits it when blank.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; cmd /c npx vitest run tests/newItemDialog.spec.ts`
Expected: FAIL because the service currently forwards only the raw item fields.

- [ ] **Step 3: Write minimal implementation**

Transform outgoing item payload inside `createItem()` so the inserted `Item` doc includes the barcode child table only when needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; cmd /c npx vitest run tests/newItemDialog.spec.ts`
Expected: PASS

## Chunk 4: Verification

### Task 4: Run focused verification

**Files:**
- Test: `frontend/tests/newItemDialog.spec.ts`
- Test: any directly impacted related tests if needed

- [ ] **Step 1: Run the targeted regression test**

Run: `cd frontend; cmd /c npx vitest run tests/newItemDialog.spec.ts`
Expected: PASS

- [ ] **Step 2: Run adjacent item-flow tests**

Run: `cd frontend; cmd /c npx vitest run tests/useScannerInput.spec.ts tests/useItemsSelectorSearch.spec.ts`
Expected: PASS

- [ ] **Step 3: Report evidence**

Capture exit codes and failing/passing counts before claiming completion.
