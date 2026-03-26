// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
	clearChunkRecoveryState,
	isDynamicImportFailure,
	recoverFromChunkLoadError,
} from "../src/posapp/utils/chunkLoadRecovery";

describe("chunk load recovery helpers", () => {
	beforeEach(() => {
		window.sessionStorage.clear();
		window.localStorage.clear();
	});

	it("detects dynamic import failures", () => {
		expect(
			isDynamicImportFailure(
				new TypeError(
					"Failed to fetch dynamically imported module: /assets/x.js",
				),
			),
		).toBe(true);
		expect(
			isDynamicImportFailure("ChunkLoadError: Loading chunk 12 failed."),
		).toBe(true);
	});

	it("ignores non-chunk errors", () => {
		expect(isDynamicImportFailure(new Error("Network timeout"))).toBe(
			false,
		);
	});

	it("preserves retry history when clearing transient progress between reloads", async () => {
		const chunkError = new TypeError(
			"Failed to fetch dynamically imported module: /assets/chunk.js",
		);

		await recoverFromChunkLoadError(chunkError, "first-load");
		expect(
			window.sessionStorage.getItem("posa_chunk_reload_once"),
		).toBe("1");

		clearChunkRecoveryState();

		await recoverFromChunkLoadError(chunkError, "after-reload");

		expect(
			window.sessionStorage.getItem("posa_chunk_cache_recovery_once"),
		).toBe("1");
	});
});

