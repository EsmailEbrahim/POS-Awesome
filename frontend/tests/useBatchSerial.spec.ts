import { describe, expect, it, vi } from "vitest";

import { useBatchSerial } from "../src/posapp/composables/pos/shared/useBatchSerial";

describe("useBatchSerial.setSerialNo", () => {
	it("does not force qty to zero when no serial is selected", () => {
		const { setSerialNo } = useBatchSerial();
		const context = { forceUpdate: vi.fn() };
		const item: any = {
			has_serial_no: 1,
			has_batch_no: 0,
			serial_no_data: [{ serial_no: "SER-001" }, { serial_no: "SER-002" }],
			serial_no_selected: [],
			stock_qty: 15,
			qty: 15,
		};

		setSerialNo(item, context);

		expect(item.qty).toBe(15);
		expect(item.serial_no_selected_count).toBe(0);
		expect(item.serial_no).toBe("");
	});

	it("preserves selected serials when serial dataset is temporarily empty", () => {
		const { setSerialNo } = useBatchSerial();
		const context = { forceUpdate: vi.fn() };
		const item: any = {
			has_serial_no: 1,
			has_batch_no: 0,
			serial_no_data: [],
			serial_no_selected: ["SER-001"],
			stock_qty: 1,
			qty: 1,
		};

		setSerialNo(item, context);

		expect(item.serial_no_selected).toEqual(["SER-001"]);
		expect(item.serial_no).toBe("SER-001");
		expect(item.serial_no_selected_count).toBe(1);
		expect(item.qty).toBe(1);
	});

	it("removes invalid serials when valid dataset exists", () => {
		const { setSerialNo } = useBatchSerial();
		const context = { forceUpdate: vi.fn() };
		const item: any = {
			has_serial_no: 1,
			has_batch_no: 0,
			serial_no_data: [{ serial_no: "SER-VALID" }],
			serial_no_selected: ["SER-VALID", "SER-INVALID"],
			stock_qty: 2,
			qty: 2,
		};

		setSerialNo(item, context);

		expect(item.serial_no_selected).toEqual(["SER-VALID"]);
		expect(item.serial_no).toBe("SER-VALID");
		expect(item.serial_no_selected_count).toBe(1);
		expect(item.qty).toBe(1);
	});
});
