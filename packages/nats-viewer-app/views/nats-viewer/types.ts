export interface LogEntry {
	id: string;
	timestamp: number;
	subject: string;
	payload: unknown;
	direction: 'in' | 'out'; // 'in' = received, 'out' = published by user
}
