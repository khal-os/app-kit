/**
 * LP Design Tokens — extracted from khal-landing hero-os-showcase.tsx
 * These are the canonical reference colors from the landing page.
 * The OS theme CSS variables consume these values.
 */

// Surface colors
export const WIN_BG = '#111318';
export const CHROME_BG = '#0D0F14';
export const CELL_BG = '#0D1017';
export const WIN_BORDER = '#1E2330';
export const WIN_BORDER_FOCUSED = '#333D55';

// Text hierarchy
export const TEXT_PRIMARY = '#E8EAF0';
export const TEXT_SECONDARY = '#8B92A5';
export const TEXT_TERTIARY = '#555D73';

// Accent
export const ACCENT_BLUE = '#0A6FE0';

// Mesh gradient palette (8-color navy-to-gold)
export const MESH_GRADIENT_PALETTE = [
	'#030508',
	'#070D15',
	'#0C1A2E',
	'#1A4A7A',
	'#2A3040',
	'#5C4A38',
	'#8B6B42',
	'#D49355',
] as const;

// Radii
export const WINDOW_RADIUS = '12px';
export const BUTTON_RADIUS = '10px';
