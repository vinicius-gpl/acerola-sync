#!/usr/bin/env node
/**
 * Prepares this machine's git for the Acerola flow. Run once after cloning:
 *
 *   node scripts/git/setup-git.mjs
 *
 * 1. Writes the `gitflow.*` keys (main, develop, feature/, bugfix/, release/, hotfix/, tag v), so
 *    Tower's Git-Flow and `git flow` open already initialized with the same names the branch
 *    guard (branch-guard.sh) and Claude use.
 * 2. Points git at the commit message template (.gitmessage).
 * 3. Installs the lefthook hooks, when lefthook is installed.
 *
 * Only writes what is missing: a different local setup is never overwritten.
 * Ported from acerola-sync (scripts/git/setup-git.mjs).
 */
import { execFileSync, spawnSync } from 'node:child_process';

const SETTINGS = {
	// This repository's hooks live in its own folder. Without it, a global core.hooksPath
	// (e.g. ~/.git-hooks) makes `lefthook install` write to the global folder and replace the
	// hooks of EVERY repository.
	'core.hooksPath': '.git/hooks',
	'gitflow.branch.master': 'main',
	'gitflow.branch.develop': 'develop',
	'gitflow.prefix.feature': 'feature/',
	'gitflow.prefix.bugfix': 'bugfix/',
	'gitflow.prefix.release': 'release/',
	'gitflow.prefix.hotfix': 'hotfix/',
	'gitflow.prefix.support': 'support/',
	'gitflow.prefix.versiontag': 'v',
	'commit.template': '.gitmessage'
};

function run(cmd, args) {
	return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function readLocal(key) {
	try {
		return run('git', ['config', '--local', '--get', key]);
	} catch {
		return '';
	}
}

let inside = false;
try {
	inside = run('git', ['rev-parse', '--is-inside-work-tree']) === 'true';
} catch {
	inside = false;
}

if (inside) {
	for (const [key, value] of Object.entries(SETTINGS)) {
		if (readLocal(key) === '') run('git', ['config', '--local', key, value]);
	}
	// lefthook refuses any custom core.hooksPath unless forced. Forcing is safe only when the local
	// value is this repository's own .git/hooks (set above): the local value wins over a global one,
	// so the hooks land here and a global ~/.git-hooks stays untouched.
	const command =
		readLocal('core.hooksPath') === '.git/hooks' ? 'lefthook install --force' : 'lefthook install';
	// One command string through the shell: mise/scoop install lefthook as a .cmd/.ps1 shim, which
	// execFile can't run, and passing an args array with shell: true is deprecated (DEP0190).
	const install = spawnSync(command, { stdio: 'inherit', shell: true });
	if (install.status === 0) {
		console.log('git pronto: Git-Flow, template de commit e hooks do lefthook.');
	} else {
		console.log('git pronto: Git-Flow e template de commit. Instale o lefthook e rode "lefthook install".');
		process.exitCode = 1;
	}
}
