/**
 * KhalOS animation presets — motion.js configurations for OS-wide use.
 * Import these in components for consistent, branded animations.
 */

/** Custom easing curve — KhalOS primary */
export const khalEasing = [0.22, 1, 0.36, 1] as const;

/** Spring config for interactive elements */
export const springConfig = {
	stiffness: 300,
	damping: 22,
} as const;

/** Window open animation — fade up with blur */
export const fadeUp = {
	initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
	animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
	transition: { duration: 0.7, ease: khalEasing },
} as const;

/** App launch animation — scale up with blur */
export const scaleUp = {
	initial: { opacity: 0, scale: 0.96, filter: 'blur(6px)' },
	animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
	transition: { duration: 0.9, ease: khalEasing },
} as const;

/** Stagger container — children appear with 0.12s delay */
export const staggerContainer = {
	animate: {
		transition: {
			staggerChildren: 0.12,
		},
	},
} as const;

/** Stagger child — each item fades up */
export const staggerChild = {
	initial: { opacity: 0, y: 8 },
	animate: { opacity: 1, y: 0 },
	transition: { duration: 0.4, ease: khalEasing },
} as const;

/** Fade in — simple opacity animation */
export const fadeIn = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	transition: { duration: 0.5, ease: khalEasing },
} as const;
