/**
 * KubernetesRuntime — runs each app instance in an isolated Kubernetes pod.
 *
 * Uses kubectl (bundled with k3s) to manage namespaces, pods, and services.
 * Works with any k8s cluster: local k3s or cloud (EKS/GKE/AKS) via kubeconfig.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseRuntime } from './base';
import type { HealthStatus, RuntimeConfig, RuntimeHealth, ServiceHealth } from './types';

const exec = promisify(execFile);

// ---------------------------------------------------------------------------
// Extended config for Kubernetes-specific options
// ---------------------------------------------------------------------------

export interface KubernetesRuntimeConfig extends RuntimeConfig {
	/** Path to kubeconfig. Defaults to k3s at /etc/rancher/k3s/k3s.yaml. */
	kubeconfig?: string;
	/** Container image to run. E.g. "khal-os/terminal-app:latest". */
	image?: string;
	/** App slug — used for namespace/pod naming and image resolution. */
	appSlug?: string;
	/** Instance ID — unique per deployment. */
	instanceId?: string;
	/** NodePort to expose (30000-32767). Auto-assigned if omitted. */
	nodePort?: number;
	/** NATS server URL apps connect to. Defaults to host NATS. */
	natsUrl?: string;
	/** Resource requests/limits. */
	resources?: {
		requests?: { cpu?: string; memory?: string };
		limits?: { cpu?: string; memory?: string };
	};
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_KUBECONFIG = '/etc/rancher/k3s/k3s.yaml';
const DEFAULT_NATS_URL = 'nats://10.43.0.1:4222'; // k3s ClusterIP routes to host
const DEFAULT_RESOURCES = {
	requests: { cpu: '100m', memory: '256Mi' },
	limits: { cpu: '1', memory: '1Gi' },
};

// ---------------------------------------------------------------------------
// KubernetesRuntime
// ---------------------------------------------------------------------------

export class KubernetesRuntime extends BaseRuntime {
	readonly type = 'kubernetes' as const;

	private readonly kubeconfig: string;
	private readonly namespace: string;
	private readonly podName: string;
	private readonly serviceName: string;
	private readonly image: string;
	private readonly instanceId: string;
	private readonly natsUrl: string;
	private readonly resources: NonNullable<KubernetesRuntimeConfig['resources']>;
	private readonly nodePort: number | undefined;
	private assignedPort: number | undefined;
	private startedAt: number | undefined;

	constructor(config: KubernetesRuntimeConfig) {
		super(config);
		const kc = config as KubernetesRuntimeConfig;
		const slug = kc.appSlug ?? 'app';
		const id = kc.instanceId ?? slug;

		this.kubeconfig = kc.kubeconfig ?? process.env.KUBECONFIG ?? DEFAULT_KUBECONFIG;
		this.namespace = `khal-${id}`.slice(0, 63).replace(/[^a-z0-9-]/g, '-');
		this.podName = `${slug}-pod`.slice(0, 63);
		this.serviceName = `${slug}-svc`.slice(0, 63);
		this.image = kc.image ?? `khal-os/${slug}:latest`;
		this.instanceId = id;
		this.natsUrl = kc.natsUrl ?? DEFAULT_NATS_URL;
		this.resources = kc.resources ?? DEFAULT_RESOURCES;
		this.nodePort = kc.nodePort;
	}

	// -----------------------------------------------------------------------
	// Dependencies
	// -----------------------------------------------------------------------

	async ensureDeps(): Promise<void> {
		this.emit({ type: 'dep:downloading', name: 'kubectl', url: 'bundled with k3s' });
		try {
			await this.kubectl(['version', '--client', '-o', 'json']);
			this.emit({ type: 'dep:ready', name: 'kubectl', path: 'kubectl' });
		} catch {
			throw new Error('kubectl not found. Install k3s or ensure kubectl is on PATH.');
		}
	}

	async depsReady(): Promise<boolean> {
		try {
			const result = await this.kubectl(['cluster-info']);
			return result.includes('running');
		} catch {
			return false;
		}
	}

	// -----------------------------------------------------------------------
	// Lifecycle
	// -----------------------------------------------------------------------

	async start(): Promise<void> {
		if (this.running) return;

		await this.ensureDeps();
		this.emit({ type: 'service:starting', name: 'kubernetes' });

		// 1. Create namespace
		await this.applyManifest(this.namespaceManifest());

		// 2. Apply pod + service
		await this.applyManifest(this.podManifest());
		await this.applyManifest(this.serviceManifest());

		// 3. Wait for pod ready (up to 120s)
		await this.waitForPod(120_000);

		// 4. Resolve assigned NodePort
		this.assignedPort = await this.resolveNodePort();

		this.running = true;
		this.startedAt = Date.now();
		this.emit({ type: 'service:ready', name: this.podName, port: this.assignedPort });
		this.emit({ type: 'runtime:ready' });
	}

	async stop(): Promise<void> {
		if (!this.running) return;

		this.emit({ type: 'service:stopped', name: this.podName });

		// Delete the entire namespace — cleans up pod + service + everything.
		try {
			await this.kubectl(['delete', 'namespace', this.namespace, '--ignore-not-found']);
		} catch {
			// Best-effort cleanup.
		}

		this.running = false;
		this.assignedPort = undefined;
		this.startedAt = undefined;
		this.emit({ type: 'runtime:stopped' });
	}

	url(): string {
		const port = this.assignedPort ?? this.nodePort ?? 30000;
		return `http://localhost:${port}`;
	}

	async health(): Promise<RuntimeHealth> {
		const services: ServiceHealth[] = [];

		try {
			const podJson = await this.kubectl(['get', 'pod', this.podName, '-n', this.namespace, '-o', 'json']);
			const pod = JSON.parse(podJson);
			const phase = pod.status?.phase ?? 'Unknown';
			const ready =
				pod.status?.conditions?.find((c: { type: string; status: string }) => c.type === 'Ready')?.status === 'True';

			const status: HealthStatus = ready ? 'healthy' : phase === 'Running' ? 'degraded' : 'unhealthy';

			services.push({
				name: this.podName,
				status,
				port: this.assignedPort,
				...(status === 'unhealthy' ? { error: `pod phase: ${phase}` } : {}),
			});
		} catch {
			services.push({
				name: this.podName,
				status: 'unhealthy',
				error: 'failed to query pod status',
			});
		}

		const allHealthy = services.every((s) => s.status === 'healthy');
		const anyUnhealthy = services.some((s) => s.status === 'unhealthy');

		return {
			status: allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded',
			services,
			uptime: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : undefined,
		};
	}

	// -----------------------------------------------------------------------
	// Manifest generators
	// -----------------------------------------------------------------------

	private namespaceManifest(): string {
		return JSON.stringify({
			apiVersion: 'v1',
			kind: 'Namespace',
			metadata: { name: this.namespace },
		});
	}

	private podManifest(): string {
		const appPort = this.config.port ?? 3000;

		return JSON.stringify({
			apiVersion: 'v1',
			kind: 'Pod',
			metadata: {
				name: this.podName,
				namespace: this.namespace,
				labels: {
					app: this.podName,
					'khal-os/instance': this.instanceId,
				},
			},
			spec: {
				containers: [
					{
						name: 'app',
						image: this.image,
						imagePullPolicy: 'IfNotPresent',
						ports: [{ containerPort: appPort, name: 'http' }],
						env: [
							{ name: 'NODE_ENV', value: 'production' },
							{ name: 'PORT', value: String(appPort) },
							{ name: 'NATS_URL', value: this.natsUrl },
							{ name: 'KHAL_INSTANCE_ID', value: this.instanceId },
							...(this.config.env ? Object.entries(this.config.env).map(([name, value]) => ({ name, value })) : []),
						],
						resources: this.resources,
						readinessProbe: {
							httpGet: { path: '/', port: appPort },
							initialDelaySeconds: 5,
							periodSeconds: 10,
						},
						livenessProbe: {
							httpGet: { path: '/', port: appPort },
							initialDelaySeconds: 15,
							periodSeconds: 20,
						},
					},
				],
				// Allow access to host network services (NATS on host).
				hostNetwork: false,
				dnsPolicy: 'ClusterFirst',
			},
		});
	}

	private serviceManifest(): string {
		const appPort = this.config.port ?? 3000;

		const spec: Record<string, unknown> = {
			type: 'NodePort',
			selector: { app: this.podName },
			ports: [
				{
					port: appPort,
					targetPort: appPort,
					protocol: 'TCP',
					name: 'http',
					...(this.nodePort ? { nodePort: this.nodePort } : {}),
				},
			],
		};

		return JSON.stringify({
			apiVersion: 'v1',
			kind: 'Service',
			metadata: {
				name: this.serviceName,
				namespace: this.namespace,
			},
			spec,
		});
	}

	// -----------------------------------------------------------------------
	// Kubectl helpers
	// -----------------------------------------------------------------------

	private async kubectl(args: string[]): Promise<string> {
		const { stdout } = await exec('kubectl', ['--kubeconfig', this.kubeconfig, ...args], {
			timeout: 30_000,
		});
		return stdout;
	}

	private applyManifest(json: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const child = execFile(
				'kubectl',
				['--kubeconfig', this.kubeconfig, 'apply', '-f', '-'],
				{ timeout: 30_000 },
				(err) => (err ? reject(err) : resolve())
			);
			child.stdin?.write(json);
			child.stdin?.end();
		});
	}

	private async waitForPod(timeoutMs: number): Promise<void> {
		const deadline = Date.now() + timeoutMs;

		while (Date.now() < deadline) {
			try {
				const result = await this.kubectl([
					'get',
					'pod',
					this.podName,
					'-n',
					this.namespace,
					'-o',
					'jsonpath={.status.phase}',
				]);

				if (result.trim() === 'Running') {
					// Check if actually ready
					const ready = await this.kubectl([
						'get',
						'pod',
						this.podName,
						'-n',
						this.namespace,
						'-o',
						'jsonpath={.status.conditions[?(@.type=="Ready")].status}',
					]);
					if (ready.trim() === 'True') return;
				}
			} catch {
				// Pod not yet available — keep waiting.
			}

			await new Promise((r) => setTimeout(r, 2_000));
		}

		throw new Error(`Pod ${this.podName} in namespace ${this.namespace} not ready within ${timeoutMs}ms`);
	}

	private async resolveNodePort(): Promise<number> {
		const result = await this.kubectl([
			'get',
			'service',
			this.serviceName,
			'-n',
			this.namespace,
			'-o',
			'jsonpath={.spec.ports[0].nodePort}',
		]);
		return Number.parseInt(result.trim(), 10);
	}
}
