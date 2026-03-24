// @ts-nocheck
import { beforeEach, describe, expect, test } from 'bun:test';
import { closeDb, getDb, initDb, isDbInitialized } from './factory';

describe('db factory', () => {
	beforeEach(async () => {
		await closeDb();
	});

	test('throws if getDb() called before initDb()', () => {
		expect(() => getDb()).toThrow('Call initDb() during host bootstrap');
	});

	test('singleton: getDb() returns same instance', () => {
		initDb({
			schema: {},
			getDatabaseUrl: () => 'postgres://localhost:5432/test',
		});
		expect(isDbInitialized()).toBe(true);
		const db1 = getDb();
		const db2 = getDb();
		expect(db1).toBe(db2);
	});

	test('closeDb resets db + config; getDb requires init again', async () => {
		initDb({
			schema: {},
			getDatabaseUrl: () => 'postgres://localhost:5432/test',
		});
		const db1 = getDb();
		await closeDb();
		expect(isDbInitialized()).toBe(false);
		expect(() => getDb()).toThrow('Call initDb() during host bootstrap');

		initDb({
			schema: {},
			getDatabaseUrl: () => 'postgres://localhost:5432/test',
		});
		const db2 = getDb();
		expect(db2).not.toBe(db1);
	});
});
