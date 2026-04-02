'use client';

import * as React from 'react';
import { cn } from '../utils';
import { StatusDot } from './status-dot';

const sizeMap = { sm: 24, md: 32, lg: 40 } as const;
const fontSizeMap = { sm: '10px', md: '12px', lg: '14px' } as const;

const statusColorMap: Record<string, string> = {
	online: 'var(--khal-status-live)',
	idle: 'var(--khal-status-warning)',
	away: 'var(--khal-status-idle)',
};

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
	name: string;
	size?: keyof typeof sizeMap;
	status?: 'online' | 'idle' | 'away' | null;
	src?: string;
}

function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) {
		return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
	}
	return name.charAt(0).toUpperCase();
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
	({ name, size = 'md', status, src, className, style, ...props }, ref) => {
		const px = sizeMap[size];
		const [imgError, setImgError] = React.useState(false);
		const showImage = src && !imgError;

		return (
			<div
				ref={ref}
				className={cn('relative inline-flex shrink-0', className)}
				style={{ width: px, height: px, ...style }}
				{...props}
			>
				{showImage ? (
					<img
						src={src}
						alt={name}
						className="h-full w-full rounded-full object-cover"
						onError={() => setImgError(true)}
					/>
				) : (
					<div
						className="flex h-full w-full select-none items-center justify-center rounded-full border font-medium [background:var(--khal-surface-raised)] [border-color:var(--khal-border-subtle)]"
						style={{ fontSize: fontSizeMap[size] }}
					>
						{getInitials(name)}
					</div>
				)}
				{status && (
					<div className="absolute -bottom-px -right-px">
						<StatusDot color={statusColorMap[status]} size="sm" label={status} pulse={status === 'online'} />
					</div>
				)}
			</div>
		);
	}
);
Avatar.displayName = 'Avatar';

export type { AvatarProps };
export { Avatar };
