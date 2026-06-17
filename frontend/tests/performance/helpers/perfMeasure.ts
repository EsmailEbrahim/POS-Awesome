export interface MeasureResult {
	label: string;
	durationMs: number;
	success: boolean;
	iterations: number;
}

export interface MeasureOptions {
	iterations?: number;
	warmup?: boolean;
}

export function measure(
	label: string,
	fn: () => void,
	options?: MeasureOptions,
): MeasureResult {
	const iterations = options?.iterations ?? 1;
	if (options?.warmup !== false) {
		fn();
	}
	const start = performance.now();
	for (let i = 0; i < iterations; i++) {
		fn();
	}
	const durationMs = (performance.now() - start) / iterations;
	return { label, durationMs, success: true, iterations };
}

export async function measureAsync(
	label: string,
	fn: () => Promise<void>,
	options?: MeasureOptions,
): Promise<MeasureResult> {
	const iterations = options?.iterations ?? 1;
	if (options?.warmup !== false) {
		await fn();
	}
	const start = performance.now();
	for (let i = 0; i < iterations; i++) {
		await fn();
	}
	const durationMs = (performance.now() - start) / iterations;
	return { label, durationMs, success: true, iterations };
}

export function assertUnderThreshold(
	label: string,
	measuredMs: number,
	thresholdMs: number,
): void {
	const { expect } = globalThis as any;
	if (typeof expect === "function") {
		expect(measuredMs, `${label} exceeded threshold of ${thresholdMs}ms`).toBeLessThan(thresholdMs);
	}
}

export function assertBetween(
	label: string,
	measuredMs: number,
	lowerMs: number,
	upperMs: number,
): void {
	const { expect } = globalThis as any;
	if (typeof expect === "function") {
		expect(
			measuredMs,
			`${label} expected between ${lowerMs}ms and ${upperMs}ms`,
		).toBeGreaterThanOrEqual(lowerMs);
		expect(
			measuredMs,
			`${label} exceeded upper bound of ${upperMs}ms`,
		).toBeLessThan(upperMs);
	}
}

export class BenchmarkCollector {
	private results: MeasureResult[] = [];

	add(result: MeasureResult): void {
		this.results.push(result);
	}

	get summary(): string {
		if (this.results.length === 0) return "No benchmarks collected.";
		const lines = this.results.map(
			(r) =>
				`  ${r.label}: ${r.durationMs.toFixed(2)}ms (${r.iterations} iteration(s))`,
		);
		return lines.join("\n");
	}

	get totalDurationMs(): number {
		return this.results.reduce((sum, r) => sum + r.durationMs, 0);
	}
}
