import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import chalk from 'chalk';

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

/** Convert kebab-case to PascalCase and append "App", e.g. "my-app" → "MyAppApp" */
function toPascalCase(name: string): string {
	return (
		name
			.split('-')
			.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
			.join('') + 'App'
	);
}

/** Convert kebab-case to Title Case, e.g. "my-app" → "My App" */
function toLabel(name: string): string {
	return name
		.split('-')
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join(' ');
}

/** Replace all {{placeholder}} markers in a string. */
function interpolate(content: string, vars: Record<string, string>): string {
	let result = content;
	for (const [key, value] of Object.entries(vars)) {
		result = result.replaceAll(`{{${key}}}`, value);
	}
	return result;
}

/** Prompt user for input with a default value. */
function prompt(rl: readline.Interface, question: string, defaultValue: string): Promise<string> {
	return new Promise((resolve) => {
		const display = defaultValue ? `${question} ${chalk.dim(`(${defaultValue})`)} ` : `${question} `;
		rl.question(display, (answer: string) => {
			resolve(answer.trim() || defaultValue);
		});
	});
}

/** Prompt user for yes/no. */
function confirm(rl: readline.Interface, question: string, defaultYes = true): Promise<boolean> {
	return new Promise((resolve) => {
		const hint = defaultYes ? 'Y/n' : 'y/N';
		rl.question(`${question} ${chalk.dim(`(${hint})`)} `, (answer: string) => {
			const a = answer.trim().toLowerCase();
			if (a === '') resolve(defaultYes);
			else resolve(a === 'y' || a === 'yes');
		});
	});
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

interface ScaffoldOptions {
	name: string;
	description: string;
	includeService: boolean;
	includeIcon: boolean;
	projectRoot: string;
}

function findTemplateDir(): string {
	// In dev: relative to this source file (packages/dev-cli/src/commands/)
	// In built: relative to dist/ (packages/dev-cli/dist/)
	const candidates = [
		path.resolve(import.meta.dirname ?? __dirname, '../../templates/app'),
		path.resolve(import.meta.dirname ?? __dirname, '../templates/app'),
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	throw new Error('Template directory not found. Expected at packages/dev-cli/templates/app/');
}

function scaffoldApp(opts: ScaffoldOptions): void {
	const { name, description, includeService, projectRoot } = opts;
	const packageName = `${name}-app`;
	const targetDir = path.join(projectRoot, 'packages', packageName);

	if (fs.existsSync(targetDir)) {
		throw new Error(`Directory already exists: packages/${packageName}`);
	}

	const templateDir = findTemplateDir();
	const componentName = toPascalCase(name);
	const label = toLabel(name);

	const vars: Record<string, string> = {
		name,
		packageName,
		label,
		description,
		componentName,
	};

	// Create target directory
	fs.mkdirSync(targetDir, { recursive: true });

	// Copy and interpolate template files
	const viewsDir = path.join(targetDir, 'views', name);
	fs.mkdirSync(path.join(viewsDir, 'ui'), { recursive: true });
	if (includeService) {
		fs.mkdirSync(path.join(viewsDir, 'service'), { recursive: true });
	}

	// manifest.ts
	const manifestSrc = fs.readFileSync(path.join(templateDir, 'manifest.ts'), 'utf8');
	let manifestContent = interpolate(manifestSrc, vars);
	if (!includeService) {
		// Remove natsPrefix line for UI-only apps
		manifestContent = manifestContent.replace(/\t\t\tnatsPrefix:.*\n/, '');
	}
	fs.writeFileSync(path.join(targetDir, 'manifest.ts'), manifestContent);

	// package.json
	const pkgTemplate = includeService ? 'package.json.tmpl' : 'package-no-service.json.tmpl';
	const pkgSrc = fs.readFileSync(path.join(templateDir, pkgTemplate), 'utf8');
	fs.writeFileSync(path.join(targetDir, 'package.json'), interpolate(pkgSrc, vars));

	// components.ts
	const componentsSrc = fs.readFileSync(path.join(templateDir, 'components.ts'), 'utf8');
	fs.writeFileSync(path.join(targetDir, 'components.ts'), interpolate(componentsSrc, vars));

	// UI component
	const uiTemplate = includeService ? 'App.tsx' : 'App-no-service.tsx';
	const uiSrc = fs.readFileSync(path.join(templateDir, 'views', '__name__', 'ui', uiTemplate), 'utf8');
	fs.writeFileSync(path.join(viewsDir, 'ui', 'App.tsx'), interpolate(uiSrc, vars));

	if (includeService) {
		// schema.ts
		const schemaSrc = fs.readFileSync(path.join(templateDir, 'views', '__name__', 'schema.ts'), 'utf8');
		fs.writeFileSync(path.join(viewsDir, 'schema.ts'), interpolate(schemaSrc, vars));

		// subjects.ts
		const subjectsSrc = fs.readFileSync(path.join(templateDir, 'views', '__name__', 'subjects.ts'), 'utf8');
		fs.writeFileSync(path.join(viewsDir, 'subjects.ts'), interpolate(subjectsSrc, vars));

		// service/index.ts
		const serviceSrc = fs.readFileSync(path.join(templateDir, 'views', '__name__', 'service', 'index.ts'), 'utf8');
		fs.writeFileSync(path.join(viewsDir, 'service', 'index.ts'), interpolate(serviceSrc, vars));
	}
}

// ---------------------------------------------------------------------------
// Export for wiring into the app command
// ---------------------------------------------------------------------------

export async function runAppCreate(nameArg?: string): Promise<void> {
	const projectRoot = process.cwd();

	// Verify we're in a KhalOS monorepo
	const rootPkg = path.join(projectRoot, 'package.json');
	if (!fs.existsSync(rootPkg)) {
		console.error(chalk.red('Error: Not in a project directory (no package.json found).'));
		process.exit(1);
	}

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

	try {
		console.log(`\n${chalk.bold('Create a new KhalOS app')}\n`);

		// Gather options
		const name = nameArg || (await prompt(rl, 'App name (kebab-case):', ''));
		if (!name) {
			console.error(chalk.red('Error: App name is required.'));
			process.exit(1);
		}
		if (!/^[a-z][a-z0-9-]*$/.test(name)) {
			console.error(chalk.red('Error: App name must be kebab-case (lowercase, hyphens, starting with a letter).'));
			process.exit(1);
		}

		const description = await prompt(rl, 'Description:', 'A KhalOS app');
		const includeService = await confirm(rl, 'Include backend service (NATS)?');
		const includeIcon = await confirm(rl, 'Include desktop icon?');

		console.log('');

		// Scaffold
		scaffoldApp({
			name,
			description,
			includeService,
			includeIcon,
			projectRoot,
		});

		const packageName = `${name}-app`;

		console.log(chalk.green(`✓ Created packages/${packageName}/`));
		console.log('');
		console.log(`  ${chalk.dim('manifest.ts')}       App metadata`);
		console.log(`  ${chalk.dim('package.json')}      Workspace package`);
		console.log(`  ${chalk.dim('components.ts')}     Lazy-load wiring`);
		console.log(`  ${chalk.dim(`views/${name}/ui/`)}  React component`);
		if (includeService) {
			console.log(`  ${chalk.dim(`views/${name}/service/`)}  NATS service`);
			console.log(`  ${chalk.dim(`views/${name}/schema.ts`)}  TypeBox schemas`);
			console.log(`  ${chalk.dim(`views/${name}/subjects.ts`)}  Subject constants`);
		}

		// Run pnpm install
		console.log('');
		console.log(chalk.dim('Running pnpm install...'));

		const { execSync } = await import('node:child_process');
		try {
			execSync('pnpm install', {
				cwd: projectRoot,
				stdio: 'pipe',
			});
			console.log(chalk.green('✓ Dependencies installed'));
		} catch {
			console.log(chalk.yellow('⚠ pnpm install failed — run it manually'));
		}

		console.log('');
		console.log(`${chalk.bold('Next steps:')}`);
		console.log(`  1. ${chalk.cyan('make dev')}  — Start the dev server`);
		console.log('  2. Open the desktop — your app should appear');
		if (includeService) {
			console.log(`  3. Click "Ping Service" to verify the backend`);
		}
		console.log('');
		console.log(`  ${chalk.dim('Tutorial:')} docs/BUILDING_APPS.md`);
		console.log('');
	} finally {
		rl.close();
	}
}
