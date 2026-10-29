// Running ncdump and turning its output into HTML. Nothing here imports vscode, so the tests can load it directly.
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface NcVariable {
	name: string;          // name as written in the CDL, backslash escapes included
	path: string;          // real name to pass to `ncdump -v`, group-qualified inside groups
	declaration: string;   // e.g. "float temp(time, lat)"
	attributes: string[];  // e.g. 'units = "K"'
}

export interface RenderedHeader {
	html: string;
	variables: NcVariable[];
	dimensions: number;
}

const SECTION = /^\s*(dimensions|variables|types|data):\s*$/;
const GROUP_OPEN = /^\s*group:\s+(.+?)\s*\{\s*$/;
const GROUP_CLOSE = /^\s*\}\s*\/\/\s*group\b/;
// "<type> <name>(<dims>) ;" or a scalar "<type> <name> ;". Names keep CDL backslash escapes.
const DECLARATION = /^(\s+)(\S+)(\s+)((?:\\.|[^\s(;\\])+)(\s*(?:\(.*\))?\s*;\s*)$/;
// "<var>:<attr> = <value> ;"
const VAR_ATTRIBUTE = /^\s+((?:\\.|[^\s:\\])+):(\S+)\s*=\s*(.*?)\s*;?\s*$/;
const MAX_TOOLTIP_VALUE = 200;

// Large variables dump far more text than we can show, so stop reading after this much
export const MAX_VARIABLE_BYTES = 10 * 1024 * 1024;
const MAX_HEADER_BYTES = 64 * 1024 * 1024;

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

export function escapeAttr(text: string): string {
	return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function unescapeCdl(name: string): string {
	return name.replace(/\\(.)/g, '$1');
}

// Parses `ncdump -h` output and wraps each variable declaration's name in a clickable span.
// Only declaration lines inside `variables:` sections are linked, so text like "foo(" inside an attribute is left alone.
export function renderHeader(raw: string): RenderedHeader {
	const lines = raw.split('\n');
	const variables: NcVariable[] = [];
	const declarations = new Map<number, { variable: NcVariable; match: RegExpMatchArray }>();
	const groups: string[] = [];
	let section = '';
	let dimensions = 0;
	let last: NcVariable | undefined;

	lines.forEach((line, i) => {
		const sectionMatch = line.match(SECTION);
		if (sectionMatch) {
			section = sectionMatch[1];
			return;
		}
		const groupOpen = line.match(GROUP_OPEN);
		if (groupOpen) {
			groups.push(unescapeCdl(groupOpen[1]));
			section = '';
			return;
		}
		if (GROUP_CLOSE.test(line)) {
			groups.pop();
			section = '';
			return;
		}
		if (section === 'dimensions' && line.includes('=')) {
			dimensions++;
			return;
		}
		if (section !== 'variables') {
			return;
		}
		const decl = line.match(DECLARATION);
		if (decl && !decl[2].includes(':')) {
			const name = decl[4];
			const realName = unescapeCdl(name);
			last = {
				name,
				path: groups.length ? '/' + [...groups, realName].join('/') : realName,
				declaration: `${decl[2]} ${name}${decl[5].replace(/\s*;\s*$/, '')}`,
				attributes: []
			};
			variables.push(last);
			declarations.set(i, { variable: last, match: decl });
			return;
		}
		const attr = line.match(VAR_ATTRIBUTE);
		if (attr && last && attr[1] === last.name) {
			const value = attr[3].length > MAX_TOOLTIP_VALUE ? attr[3].slice(0, MAX_TOOLTIP_VALUE) + '…' : attr[3];
			last.attributes.push(`${attr[2]} = ${value}`);
		}
	});

	const html = lines.map((line, i) => {
		const decl = declarations.get(i);
		if (!decl) {
			return escapeHtml(line);
		}
		const [, indent, type, gap, name, rest] = decl.match;
		const tooltip = [decl.variable.declaration, ...decl.variable.attributes].join('\n');
		return `${indent}${escapeHtml(type)}${gap}<span class="variable" data-var="${escapeAttr(decl.variable.path)}" title="${escapeAttr(tooltip)}">${escapeHtml(name)}</span>${escapeHtml(rest)}`;
	}).join('\n');

	return { html, variables, dimensions };
}

// Pulls one variable's values out of `ncdump -v` output. ncdump prints the whole header and a `data:` section
// for every group, so look for the "<name> =" line rather than assuming the first `data:` is the right one.
export function extractVariableData(output: string, cdlName: string): string {
	const escaped = cdlName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const dataStart = output.search(/^[ \t]*data:[ \t]*$/m);
	if (dataStart === -1) {
		return '';
	}
	const afterData = output.slice(dataStart);
	const start = afterData.search(new RegExp(`^[ \\t]*${escaped}[ \\t]*=`, 'm'));
	if (start === -1) {
		return afterData.replace(/^[ \t]*data:[ \t]*\n/, '').trim();
	}
	const fromVar = afterData.slice(start);
	const end = fromVar.search(/ ;[ \t]*$/m);
	return (end === -1 ? fromVar : fromVar.slice(0, end + 2)).trim();
}

// Accepts "~/..." in the path settings, since people copy those straight from their shell
export function expandHome(p: string): string {
	return p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p;
}

export function findExecutable(command: string): string | undefined {
	const expanded = expandHome(command);
	if (expanded.includes('/') || expanded.includes('\\')) {
		return fs.existsSync(expanded) ? expanded : undefined;
	}
	const extensions = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
	for (const dir of (process.env.PATH || '').split(path.delimiter)) {
		for (const ext of extensions) {
			const candidate = path.join(dir, expanded + ext);
			if (dir && fs.existsSync(candidate)) {
				return candidate;
			}
		}
	}
	return undefined;
}

// Quotes a value for the user's terminal shell
export function shellQuote(value: string): string {
	if (process.platform === 'win32') {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function describeFailure(ncdumpPath: string, error: { code?: string | number | null; message: string }, stderr: string): string {
	if (error.code === 'ENOENT') {
		return `Couldn't find ncdump (looked for "${ncdumpPath}"). Install NetCDF or set "manishsfantasticdump.ncdumpPath" to the full path of ncdump.`;
	}
	return stderr.trim() || error.message;
}

function runNcdumpWith(ncdumpPath: string, args: string[]): Promise<string> {
	const command = expandHome(ncdumpPath);
	return new Promise((resolve, reject) => {
		execFile(command, args, { maxBuffer: MAX_HEADER_BYTES }, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(describeFailure(command, error, stderr)));
			} else {
				resolve(stdout);
			}
		});
	});
}

export function runNcdump(ncdumpPath: string, filePath: string): Promise<string> {
	return runNcdumpWith(ncdumpPath, ['-h', filePath]);
}

export async function runNcdumpKind(ncdumpPath: string, filePath: string): Promise<string> {
	return (await runNcdumpWith(ncdumpPath, ['-k', filePath])).trim();
}

export function runNcdumpVariable(ncdumpPath: string, filePath: string, variablePath: string, cdlName: string): Promise<string> {
	const command = expandHome(ncdumpPath);
	return new Promise((resolve, reject) => {
		const proc = spawn(command, ['-v', variablePath, filePath]);
		const chunks: Buffer[] = [];
		let size = 0;
		let truncated = false;
		let stderr = '';
		proc.stdout.on('data', (chunk: Buffer) => {
			if (truncated) { return; }
			chunks.push(chunk);
			size += chunk.length;
			if (size >= MAX_VARIABLE_BYTES) {
				truncated = true;
				proc.kill();
			}
		});
		proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
		proc.on('error', (error) => reject(new Error(describeFailure(command, error, stderr))));
		proc.on('close', (code) => {
			if (code !== 0 && !truncated) {
				reject(new Error(stderr.trim() || `ncdump exited with code ${code}`));
				return;
			}
			let output = extractVariableData(Buffer.concat(chunks).toString(), cdlName);
			if (truncated) {
				output += `\n\n... output truncated at ${MAX_VARIABLE_BYTES / (1024 * 1024)} MB. Use ncdump or ncview to see the rest.`;
			}
			resolve(output);
		});
	});
}

export function normalizeFormat(kind: string): string {
	switch (kind.trim()) {
		case 'classic': return 'NetCDF-3';
		case '64-bit offset': return 'NetCDF-3 (64-bit)';
		case 'cdf5': return 'NetCDF-3 (CDF-5)';
		case 'netCDF-4': return 'NetCDF-4';
		case 'netCDF-4 classic model': return 'NetCDF-4 Classic';
		default: return kind.trim() || 'Unknown';
	}
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) { return `${bytes} B`; }
	if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB`; }
	if (bytes < 1024 * 1024 * 1024) { return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function buildSummaryHtml(variables: number, dimensions: number, fileSize: number, kind: string): string {
	const chip = (label: string, value: string) =>
		`<span class="summary-chip"><span class="summary-label">${label}</span>${value}</span>`;
	return `<div class="file-summary">${chip('Format', escapeHtml(normalizeFormat(kind)))}${chip('Variables', String(variables))}${chip('Dimensions', String(dimensions))}${chip('Size', formatFileSize(fileSize))}</div>`;
}
