'use client';

import { useEffect, useRef, useState } from 'react';

interface AudioWaveformPanelProps {
	speaking: boolean;
	connected: boolean;
}

const BAR_KEYS = ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9'] as const;

export function AudioWaveformPanel({ speaking, connected }: AudioWaveformPanelProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [compact, setCompact] = useState(false);

	useEffect(() => {
		if (!containerRef.current) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setCompact(entry.contentRect.height < 60);
			}
		});
		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	if (!connected) {
		return (
			<div className="flex h-full items-center justify-center text-copy-13 text-gray-500">
				Connect to an agent to view audio
			</div>
		);
	}

	if (compact) {
		return (
			<div ref={containerRef} className="flex h-full items-center justify-center">
				<div className={`h-3 w-3 rounded-full ${speaking ? 'animate-pulse bg-green-500' : 'bg-gray-300'}`} />
			</div>
		);
	}

	return (
		<div ref={containerRef} className="flex h-full flex-col p-3">
			<h3 className="mb-2 text-label-13 font-medium text-gray-800">Audio</h3>
			<div className="flex flex-1 items-end justify-center gap-1">
				{BAR_KEYS.map((key, i) => (
					<div
						key={key}
						className={`w-2 rounded-full transition-all duration-150 ${
							speaking ? 'bg-green-500' : 'bg-gray-300 opacity-30'
						}`}
						style={
							speaking
								? {
										animation: `waveform-bounce ${400 + ((i * 37) % 200)}ms ease-in-out infinite alternate`,
										animationDelay: `${i * 50}ms`,
										height: `${20 + ((i * 17 + 13) % 60)}%`,
									}
								: { height: '4px' }
						}
					/>
				))}
			</div>
			<style>{`
        @keyframes waveform-bounce {
          0% { height: 15%; }
          100% { height: ${speaking ? '85%' : '15%'}; }
        }
      `}</style>
		</div>
	);
}
