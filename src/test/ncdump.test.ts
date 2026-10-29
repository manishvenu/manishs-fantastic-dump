import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import {
	buildSummaryHtml, escapeAttr, escapeHtml, expandHome, extractVariableData,
	formatFileSize, normalizeFormat, renderHeader, shellQuote
} from '../ncdump';

const HEADER = `netcdf sample {
dimensions:
	time = UNLIMITED ; // (2 currently)
	lat = 3 ;
variables:
	float temp(time, lat) ;
		temp:units = "K" ;
		temp:comment = "see f(x) and <b>bold</b> $& here" ;
	int scalar ;
	double my\\ var(lat) ;

// global attributes:
		:history = "made by func(1)" ;

group: forecast {
  dimensions:
  	step = 4 ;
  variables:
  	float temp(step) ;
  } // group forecast
}
`;

suite('renderHeader', () => {
	const { html, variables, dimensions } = renderHeader(HEADER);

	test('finds declarations in root and groups, including scalars and escaped names', () => {
		assert.deepStrictEqual(variables.map(v => v.path), ['temp', 'scalar', 'my var', '/forecast/temp']);
		assert.deepStrictEqual(variables.map(v => v.name), ['temp', 'scalar', 'my\\ var', 'temp']);
	});

	test('counts dimensions in every group', () => {
		assert.strictEqual(dimensions, 3);
	});

	test('links only declaration names, not words before "(" in attributes or type keywords', () => {
		assert.strictEqual((html.match(/class="variable"/g) || []).length, 4);
		assert.ok(html.includes('f(x)'));
		assert.ok(html.includes('func(1)'));
		assert.ok(!html.includes('>float</span>'));
	});

	test('escapes metadata', () => {
		assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt;'));
		assert.ok(!html.includes('<b>'));
	});

	test('collects attributes for the hover tooltip', () => {
		assert.strictEqual(variables[0].declaration, 'float temp(time, lat)');
		assert.deepStrictEqual(variables[0].attributes, ['units = "K"', 'comment = "see f(x) and <b>bold</b> $& here"']);
		assert.ok(html.includes('data-var="/forecast/temp"'));
		assert.ok(html.includes('title="float temp(time, lat)\nunits = &quot;K&quot;'));
	});
});

suite('extractVariableData', () => {
	test('returns the variable block from the root data section', () => {
		const output = `${HEADER.replace(/\}\n$/, '')}data:\n\n temp =\n  1, 2, 3,\n  4, 5, 6 ;\n\n scalar = 7 ;\n}\n`;
		assert.strictEqual(extractVariableData(output, 'temp'), 'temp =\n  1, 2, 3,\n  4, 5, 6 ;');
	});

	test('finds a grouped variable after an empty root data section', () => {
		const output = 'netcdf x {\nvariables:\n\tint a ;\ndata:\n\ngroup: g {\n  variables:\n  \tfloat temp(s) ;\n  data:\n\n   temp = 1, 2 ;\n  } // group g\n}\n';
		assert.strictEqual(extractVariableData(output, 'temp'), 'temp = 1, 2 ;');
	});

	test('ignores "data:" text inside attributes', () => {
		const output = 'netcdf x {\nvariables:\n\tint a ;\n\t\ta:note = "raw data: here" ;\ndata:\n\n a = 5 ;\n}\n';
		assert.strictEqual(extractVariableData(output, 'a'), 'a = 5 ;');
	});

	test('keeps everything when output was truncated mid-variable', () => {
		const output = 'netcdf x {\ndata:\n\n big = 1, 2, 3,\n  4, 5,';
		assert.strictEqual(extractVariableData(output, 'big'), 'big = 1, 2, 3,\n  4, 5,');
	});
});

suite('helpers', () => {
	test('escapeHtml and escapeAttr', () => {
		assert.strictEqual(escapeHtml('a < b & c > d'), 'a &lt; b &amp; c &gt; d');
		assert.strictEqual(escapeAttr(`"it's"`), '&quot;it&#39;s&quot;');
	});

	test('shellQuote neutralises quotes and substitutions', function () {
		if (process.platform === 'win32') { this.skip(); }
		assert.strictEqual(shellQuote(`a b's $(rm) "x"`), `'a b'\\''s $(rm) "x"'`);
	});

	test('expandHome', () => {
		assert.strictEqual(expandHome('~/bin/ncdump'), path.join(os.homedir(), 'bin/ncdump'));
		assert.strictEqual(expandHome('/usr/bin/ncdump'), '/usr/bin/ncdump');
		assert.strictEqual(expandHome('ncdump'), 'ncdump');
	});

	test('summary formatting', () => {
		assert.strictEqual(normalizeFormat('netCDF-4 classic model'), 'NetCDF-4 Classic');
		assert.strictEqual(normalizeFormat(''), 'Unknown');
		assert.strictEqual(formatFileSize(1536), '1.5 KB');
		assert.ok(buildSummaryHtml(4, 3, 10, 'classic').includes('NetCDF-3'));
	});
});
