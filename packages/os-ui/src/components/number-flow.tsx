'use client';

import NumberFlowBase from '@number-flow/react';
import type { ComponentProps } from 'react';

type NumberFlowProps = ComponentProps<typeof NumberFlowBase>;

/**
 * NumberFlow — animated number transitions via @number-flow/react.
 * Thin wrapper that sets KhalOS-branded timing defaults.
 */
function NumberFlow({ transformTiming, spinTiming, opacityTiming, ...props }: NumberFlowProps) {
	return (
		<NumberFlowBase
			transformTiming={transformTiming ?? { duration: 800, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
			spinTiming={spinTiming ?? { duration: 800, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
			opacityTiming={opacityTiming ?? { duration: 350, easing: 'ease-out' }}
			willChange
			{...props}
		/>
	);
}

export type { NumberFlowProps };
export { NumberFlow };
