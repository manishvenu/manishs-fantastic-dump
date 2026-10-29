import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension', () => {
	test('activates and registers the ncview command', async () => {
		const extension = vscode.extensions.getExtension('ManishVenumuddula.manishsfantasticdump');
		assert.ok(extension);
		await extension.activate();
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('extension.openInNcview'));
	});
});
