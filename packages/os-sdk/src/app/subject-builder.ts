/**
 * Fluent builder for NATS subject strings following KhalOS conventions.
 *
 * All KhalOS subjects follow the pattern: `khal.{orgId}.{appPrefix}.{...segments}`
 *
 * @example
 * ```ts
 * const listUsers = new SubjectBuilder('myapp').action('users').action('list').build();
 * listUsers('org-123'); // → 'khal.org-123.myapp.users.list'
 *
 * const userData = new SubjectBuilder('myapp').action('users').param().action('data').build();
 * userData('org-123', 'user-456'); // → 'khal.org-123.myapp.users.user-456.data'
 * ```
 */
export class SubjectBuilder {
	private parts: (string | null)[] = [];

	constructor(private appPrefix: string) {}

	/** Append a static segment to the subject. */
	action(name: string): this {
		this.parts.push(name);
		return this;
	}

	/** Append a dynamic parameter slot filled at call time. */
	param(): this {
		this.parts.push(null);
		return this;
	}

	/**
	 * Build the subject template function.
	 * The returned function takes `orgId` as the first argument,
	 * followed by one string for each `.param()` slot in order.
	 */
	build(): (orgId: string, ...params: string[]) => string {
		const prefix = this.appPrefix;
		const parts = [...this.parts];
		return (orgId: string, ...params: string[]) => {
			let paramIdx = 0;
			const segments = parts.map((p) => (p === null ? params[paramIdx++] : p));
			return `khal.${orgId}.${prefix}.${segments.join('.')}`;
		};
	}
}
