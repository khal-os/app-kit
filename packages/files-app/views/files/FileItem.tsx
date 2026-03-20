'use client';

import {
	File,
	FileArchive,
	FileAudio,
	FileCode,
	FileImage,
	FileJson,
	FileSpreadsheet,
	FileText,
	FileVideo,
	Folder,
} from 'lucide-react';
import type { FileEntry } from './schema';

/**
 * Map of file extensions to icon components.
 */
const extensionIcons: Record<string, typeof File> = {
	// Images
	png: FileImage,
	jpg: FileImage,
	jpeg: FileImage,
	gif: FileImage,
	svg: FileImage,
	webp: FileImage,
	ico: FileImage,
	// Video
	mp4: FileVideo,
	mov: FileVideo,
	avi: FileVideo,
	mkv: FileVideo,
	webm: FileVideo,
	// Audio
	mp3: FileAudio,
	wav: FileAudio,
	flac: FileAudio,
	ogg: FileAudio,
	// Code
	ts: FileCode,
	tsx: FileCode,
	js: FileCode,
	jsx: FileCode,
	py: FileCode,
	rb: FileCode,
	go: FileCode,
	rs: FileCode,
	c: FileCode,
	cpp: FileCode,
	h: FileCode,
	css: FileCode,
	html: FileCode,
	// Data
	json: FileJson,
	yaml: FileCode,
	yml: FileCode,
	toml: FileCode,
	xml: FileCode,
	// Documents
	md: FileText,
	txt: FileText,
	pdf: FileText,
	doc: FileText,
	docx: FileText,
	// Spreadsheets
	csv: FileSpreadsheet,
	xls: FileSpreadsheet,
	xlsx: FileSpreadsheet,
	// Archives
	zip: FileArchive,
	tar: FileArchive,
	gz: FileArchive,
	rar: FileArchive,
	'7z': FileArchive,
};

/**
 * Get the appropriate icon component for a file entry.
 */
export function getFileIcon(entry: FileEntry): typeof File {
	if (entry.isDir) return Folder;
	const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
	return extensionIcons[ext] ?? File;
}

/**
 * Format file size in human-readable format.
 */
export function formatSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / 1024 ** i;
	return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

/**
 * Format a timestamp (epoch ms) as a relative or short date string.
 */
export function formatDate(mtime: number): string {
	if (mtime === 0) return '--';
	const now = Date.now();
	const diff = now - mtime;

	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return 'just now';

	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;

	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;

	const date = new Date(mtime);
	const month = date.toLocaleString('en', { month: 'short' });
	const day = date.getDate();
	const year = date.getFullYear();
	const currentYear = new Date().getFullYear();

	if (year === currentYear) {
		return `${month} ${day}`;
	}
	return `${month} ${day}, ${year}`;
}
