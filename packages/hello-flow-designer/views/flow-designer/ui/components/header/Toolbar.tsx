import {
	ChevronRight,
	Download,
	FileText,
	FolderOpen,
	MoreHorizontal,
	Plus,
	Redo2,
	Save,
	Undo2,
	Upload,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { deleteFlow, listFlows, loadFlow, saveFlow } from '../../../../../lib/api/flowApi';
import { generatePythonCode } from '../../../../../lib/codegen/pythonGenerator';
import { flowJsonToReactFlow, reactFlowToFlowJson } from '../../../../../lib/convert/flowAdapters';
import { EXAMPLES } from '../../../../../lib/examples';
import type { FlowJson } from '../../../../../lib/schema/flow.schema';
import { useEditorStore } from '../../../../../lib/store/editorStore';
import type { FlowEdge, FlowNode } from '../../../../../lib/types/flowTypes';
import { customGraphChecks, validateFlowJson } from '../../../../../lib/validation/validator';
import { Button } from '../ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { showToast } from '../ui/Toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type Props = {
	nodes: FlowNode[];
	edges: FlowEdge[];
	setNodes: (nodes: FlowNode[]) => void;
	setEdges: (edges: FlowEdge[] | ((edges: FlowEdge[]) => FlowEdge[])) => void;
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onNewFlow: () => void;
	flowMeta: { slug: string | null; name: string; dirty: boolean };
	setFlowMeta: (meta: { slug: string | null; name: string; dirty: boolean }) => void;
};

export default function Toolbar({
	nodes,
	edges,
	setNodes,
	setEdges,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	onNewFlow,
	flowMeta,
	setFlowMeta,
}: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const rfInstance = useEditorStore((state) => state.rfInstance);
	const showNodesPanel = useEditorStore((state) => state.showNodesPanel);
	const setShowNodesPanel = useEditorStore((state) => state.setShowNodesPanel);

	const [showSaveDialog, setShowSaveDialog] = useState(false);
	const [saveName, setSaveName] = useState('');
	const [showLoadDialog, setShowLoadDialog] = useState(false);
	const [savedFlows, setSavedFlows] = useState<
		Array<{ slug: string; name: string; description?: string; updatedAt: string }>
	>([]);
	const [loadingFlows, setLoadingFlows] = useState(false);

	function onExport() {
		const json = reactFlowToFlowJson(nodes, edges);
		const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'flow.json';
		a.click();
		URL.revokeObjectURL(a.href);
	}

	function onExportPython() {
		const json = reactFlowToFlowJson(nodes, edges);
		const r = validateFlowJson(json);
		if (!r.valid) {
			showToast('Flow must be valid before exporting Python code', 'error');
			return;
		}
		try {
			const pythonCode = generatePythonCode(json);
			const blob = new Blob([pythonCode], { type: 'text/x-python' });
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = `${json.meta.name.toLowerCase().replace(/\s+/g, '_')}_flow.py`;
			a.click();
			URL.revokeObjectURL(a.href);
			showToast('Python code exported successfully', 'success');
		} catch (_error) {
			showToast('Failed to generate Python code', 'error');
		}
	}

	function onImport(file: File, input: HTMLInputElement) {
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const json = JSON.parse(String(reader.result));
				const r = validateFlowJson(json);
				if (!r.valid) {
					const errors = r.errors?.map((e) => `${e.instancePath}: ${e.message}`).join('\n');
					showToast(`Invalid JSON schema:\n${errors || 'Unknown error'}`, 'error');
					return;
				}
				const custom = customGraphChecks(json);
				if (custom.length) {
					showToast(`Graph validation failed: ${custom.map((e) => e.message).join(', ')}`, 'error');
					return;
				}
				const rf = flowJsonToReactFlow(json);
				setNodes(rf.nodes as FlowNode[]);
				setEdges(rf.edges as FlowEdge[]);
				setFlowMeta({
					slug: null,
					name: json.meta?.name || 'Imported Flow',
					dirty: false,
				});
				showToast('Flow imported successfully', 'success');
				setTimeout(() => {
					rfInstance?.fitView?.({ padding: 0.2, duration: 300 });
				}, 100);
				input.value = '';
			} catch {
				showToast('Failed to parse JSON file', 'error');
			}
		};
		reader.readAsText(file);
	}

	const handleSave = useCallback(async () => {
		if (flowMeta.slug) {
			try {
				const json = reactFlowToFlowJson(nodes, edges);
				await saveFlow(flowMeta.slug, flowMeta.name, undefined, json);
				setFlowMeta({ ...flowMeta, dirty: false });
				showToast('Flow saved', 'success');
			} catch {
				showToast('Failed to save flow. Changes saved locally.', 'error');
			}
		} else {
			setSaveName(flowMeta.name || 'Untitled');
			setShowSaveDialog(true);
		}
	}, [flowMeta, nodes, edges, setFlowMeta]);

	const handleSaveAs = useCallback(async () => {
		if (!saveName.trim()) return;
		const slug = saveName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		try {
			const json = reactFlowToFlowJson(nodes, edges);
			json.meta.name = saveName;
			await saveFlow(slug, saveName, undefined, json);
			setFlowMeta({ slug, name: saveName, dirty: false });
			setShowSaveDialog(false);
			showToast('Flow saved', 'success');
		} catch {
			showToast('Failed to save flow. Changes saved locally.', 'error');
		}
	}, [saveName, nodes, edges, setFlowMeta]);

	const handleOpenFlowList = useCallback(async () => {
		setShowLoadDialog(true);
		setLoadingFlows(true);
		try {
			const res = await listFlows();
			if (res.ok) {
				setSavedFlows(res.flows);
			}
		} catch {
			showToast('Failed to load flow list', 'error');
		} finally {
			setLoadingFlows(false);
		}
	}, []);

	const handleLoadFlow = useCallback(
		async (slug: string) => {
			try {
				const res = await loadFlow(slug);
				if (res.ok && res.flow) {
					const rf = flowJsonToReactFlow(res.flow);
					setNodes(rf.nodes as FlowNode[]);
					setEdges(rf.edges as FlowEdge[]);
					setFlowMeta({ slug, name: res.name || slug, dirty: false });
					setShowLoadDialog(false);
					showToast('Flow loaded', 'success');
					setTimeout(() => {
						rfInstance?.fitView?.({ padding: 0.2, duration: 300 });
					}, 100);
				} else {
					showToast(res.error || 'Failed to load flow', 'error');
				}
			} catch {
				showToast('Failed to load flow', 'error');
			}
		},
		[setNodes, setEdges, setFlowMeta, rfInstance]
	);

	const handleDeleteFlow = useCallback(async (slug: string) => {
		try {
			const res = await deleteFlow(slug);
			if (res.ok) {
				setSavedFlows((f) => f.filter((flow) => flow.slug !== slug));
				showToast('Flow deleted', 'success');
			} else {
				showToast(res.error || 'Failed to delete flow', 'error');
			}
		} catch {
			showToast('Failed to delete flow', 'error');
		}
	}, []);

	return (
		<TooltipProvider>
			<div
				className={`absolute top-2 md:top-4 left-2 z-10 flex gap-2 rounded-md bg-white/80 p-2 text-sm shadow backdrop-blur dark:bg-black/40 transition-all duration-300 ${
					showNodesPanel ? 'left-[232px]' : ''
				}`}
			>
				{!showNodesPanel && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="secondary" size="sm" className="h-8 w-8 p-0" onClick={() => setShowNodesPanel(true)}>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent align="start">Show nodes panel</TooltipContent>
					</Tooltip>
				)}
				<Button variant="secondary" size="sm" onClick={onNewFlow} title="Create a new flow">
					<Plus className="h-4 w-4" />
					<span className="sr-only lg:not-sr-only">New</span>
				</Button>
				<div className="w-px bg-neutral-300 dark:bg-neutral-700" />
				{/* Save */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="secondary" size="sm" onClick={handleSave} className="px-2">
							<Save className="h-4 w-4" />
							<span className="sr-only lg:not-sr-only">Save{flowMeta.dirty ? '*' : ''}</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Save (Ctrl/Cmd+S)</p>
					</TooltipContent>
				</Tooltip>
				{/* Open */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="secondary" size="sm" onClick={handleOpenFlowList} className="px-2">
							<FolderOpen className="h-4 w-4" />
							<span className="sr-only lg:not-sr-only">Open</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Open saved flow</p>
					</TooltipContent>
				</Tooltip>
				<div className="w-px bg-neutral-300 dark:bg-neutral-700" />
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="secondary" size="sm" onClick={onUndo} disabled={!canUndo} className="px-2">
							<Undo2 className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Undo (Cmd/Ctrl+Z)</p>
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="secondary" size="sm" onClick={onRedo} disabled={!canRedo} className="px-2">
							<Redo2 className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Redo (Cmd/Ctrl+Shift+Z)</p>
					</TooltipContent>
				</Tooltip>
				<div className="w-px bg-neutral-300 dark:bg-neutral-700" />
				{/* Import */}
				<Input
					ref={inputRef}
					type="file"
					accept="application/json"
					className="hidden"
					onChange={(e) => e.target.files && onImport(e.target.files[0], e.target)}
				/>
				<Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} className="hidden md:flex">
					<Upload className="h-4 w-4 md:mr-1.5" />
					<span className="sr-only lg:not-sr-only">Import</span>
				</Button>
				{/* Export dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="secondary" size="sm" className="hidden md:flex gap-1.5">
							<Download className="h-4 w-4" />
							<span className="sr-only lg:not-sr-only">Export</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onExport}>Export JSON</DropdownMenuItem>
						<DropdownMenuItem onClick={onExportPython}>Export Python</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				{/* Mobile more menu */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="secondary" size="sm" className="gap-1.5 md:hidden">
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={handleSave}>
							<Save className="mr-2 h-4 w-4" />
							Save
						</DropdownMenuItem>
						<DropdownMenuItem onClick={handleOpenFlowList}>
							<FolderOpen className="mr-2 h-4 w-4" />
							Open
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => inputRef.current?.click()}>
							<Upload className="mr-2 h-4 w-4" />
							Import
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onExport}>
							<Download className="mr-2 h-4 w-4" />
							Export JSON
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onExportPython}>
							<Download className="mr-2 h-4 w-4" />
							Export Python
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						{EXAMPLES.map((ex) => (
							<DropdownMenuItem
								key={ex.id}
								onClick={() => {
									const rf = flowJsonToReactFlow(ex.json as FlowJson);
									setNodes(rf.nodes as FlowNode[]);
									setEdges(rf.edges as FlowEdge[]);
									setTimeout(() => {
										rfInstance?.fitView?.({ padding: 0.2, duration: 300 });
									}, 100);
								}}
							>
								<FileText className="mr-2 h-4 w-4" />
								{ex.name}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				{/* Load Templates dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="secondary" size="sm" className="hidden md:flex gap-1.5">
							<FileText className="h-4 w-4" />
							<span className="hidden md:inline">Templates</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{EXAMPLES.map((ex) => (
							<DropdownMenuItem
								key={ex.id}
								onClick={() => {
									const rf = flowJsonToReactFlow(ex.json as FlowJson);
									setNodes(rf.nodes as FlowNode[]);
									setEdges(rf.edges as FlowEdge[]);
									setFlowMeta({ slug: null, name: ex.name, dirty: false });
									setTimeout(() => {
										rfInstance?.fitView?.({ padding: 0.2, duration: 300 });
									}, 100);
								}}
							>
								{ex.name}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Save dialog */}
			{showSaveDialog && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="rounded-lg border bg-white p-6 shadow-xl dark:bg-neutral-900 w-80 space-y-4">
						<h3 className="text-sm font-semibold">Save Flow</h3>
						<Input
							value={saveName}
							onChange={(e) => setSaveName(e.target.value)}
							placeholder="Flow name"
							autoFocus
							onKeyDown={(e) => {
								if (e.key === 'Enter') handleSaveAs();
								if (e.key === 'Escape') setShowSaveDialog(false);
							}}
						/>
						<div className="flex justify-end gap-2">
							<Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(false)}>
								Cancel
							</Button>
							<Button size="sm" onClick={handleSaveAs}>
								Save
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Load dialog */}
			{showLoadDialog && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="rounded-lg border bg-white p-6 shadow-xl dark:bg-neutral-900 w-96 max-h-[70vh] flex flex-col space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-semibold">Saved Flows</h3>
							<Button variant="ghost" size="sm" onClick={() => setShowLoadDialog(false)}>
								&times;
							</Button>
						</div>
						<div className="flex-1 overflow-y-auto space-y-2 min-h-0">
							{loadingFlows && <div className="text-xs text-neutral-500 py-4 text-center">Loading...</div>}
							{!loadingFlows && savedFlows.length === 0 && (
								<div className="text-xs text-neutral-500 py-4 text-center">No saved flows</div>
							)}
							{savedFlows.map((flow) => (
								<div
									key={flow.slug}
									className="flex items-center justify-between rounded border p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
									onClick={() => handleLoadFlow(flow.slug)}
								>
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium truncate">{flow.name}</div>
										{flow.description && <div className="text-xs text-neutral-500 truncate">{flow.description}</div>}
										{flow.updatedAt && (
											<div className="text-[10px] text-neutral-400">{new Date(flow.updatedAt).toLocaleString()}</div>
										)}
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0 shrink-0 text-red-500 hover:text-red-700"
										onClick={(e) => {
											e.stopPropagation();
											handleDeleteFlow(flow.slug);
										}}
									>
										&times;
									</Button>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</TooltipProvider>
	);
}
