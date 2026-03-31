'use client';

import { useNats } from '@khal-os/sdk/app';
import { Button, Input } from '@khal-os/ui';
import { PhoneForwarded } from 'lucide-react';
import { useCallback, useState } from 'react';
import { cmd, TRANSFER } from '../../lib/subjects';

interface TakeoverButtonProps {
	agentId: string | null;
	disabled: boolean;
}

type Phase = 'default' | 'confirming' | 'transferred';

export function TakeoverButton({ agentId, disabled }: TakeoverButtonProps) {
	const { publish } = useNats();
	const [operatorPhone, setOperatorPhone] = useState('');
	const [phase, setPhase] = useState<Phase>('default');

	const handleTransfer = useCallback(() => {
		if (phase === 'default') {
			setPhase('confirming');
			return;
		}

		if (phase === 'confirming' && agentId && operatorPhone.trim()) {
			publish(cmd(agentId, TRANSFER), { phone_number: operatorPhone.trim() });
			setPhase('transferred');
			setTimeout(() => setPhase('default'), 5000);
		}
	}, [phase, agentId, operatorPhone, publish]);

	const handleCancel = () => setPhase('default');

	const phaseStyles: Record<Phase, string> = {
		default: 'bg-blue-600 hover:bg-blue-500',
		confirming: 'bg-amber-600 hover:bg-amber-500',
		transferred: 'bg-green-600 hover:bg-green-500',
	};

	const phaseLabel: Record<Phase, string> = {
		default: 'Take Over Call',
		confirming: 'Confirm Transfer?',
		transferred: 'Transferred!',
	};

	return (
		<div className="flex flex-col gap-2 p-3">
			<label className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Operator Phone</label>
			<Input
				type="tel"
				placeholder="+55 11 9XXXX-XXXX"
				value={operatorPhone}
				onChange={(e) => setOperatorPhone(e.target.value)}
				disabled={disabled || !agentId || phase === 'transferred'}
				className="bg-background-200 text-sm"
			/>
			<div className="flex gap-2">
				<Button
					className={`flex-1 gap-2 text-white ${phaseStyles[phase]}`}
					onClick={handleTransfer}
					disabled={disabled || !agentId || !operatorPhone.trim() || phase === 'transferred'}
				>
					<PhoneForwarded className="h-4 w-4" />
					{phaseLabel[phase]}
				</Button>
				{phase === 'confirming' && (
					<Button variant="ghost" className="text-gray-400" onClick={handleCancel}>
						Cancel
					</Button>
				)}
			</div>
		</div>
	);
}
