'use client';

import { useCallback } from 'react';
import { useNats } from '@/lib/hooks/use-nats';
import { cmd, SEND_DTMF } from '../../lib/subjects';

interface DTMFPadProps {
	agentId: string | null;
	disabled: boolean;
}

const KEYS = [
	['1', '2', '3'],
	['4', '5', '6'],
	['7', '8', '9'],
	['*', '0', '#'],
] as const;

export function DTMFPad({ agentId, disabled }: DTMFPadProps) {
	const { publish } = useNats();

	const handleKey = useCallback(
		(digit: string) => {
			if (!agentId) return;
			publish(cmd(agentId, SEND_DTMF), { digits: digit });
		},
		[agentId, publish]
	);

	return (
		<div className="flex flex-col gap-1.5 p-3">
			<label className="text-[11px] font-medium uppercase tracking-wider text-gray-500">DTMF</label>
			<div className="grid grid-cols-3 gap-1.5">
				{KEYS.flat().map((digit) => (
					<button
						key={digit}
						type="button"
						disabled={disabled || !agentId}
						className="flex h-10 items-center justify-center rounded-md border border-white/10 bg-background-200 font-mono text-base text-gray-200 transition-colors hover:bg-background-300 active:bg-blue-600/30 active:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
						onClick={() => handleKey(digit)}
					>
						{digit}
					</button>
				))}
			</div>
		</div>
	);
}
