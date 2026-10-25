/**
 * Prepara o git desta máquina para o fluxo do projeto. Roda sozinho no `npm install`.
 *
 * 1. O Git-Flow do Tower lê as chaves `gitflow.*` do `.git/config`. Gravá-las aqui faz o
 *    Tower já abrir com o Git-Flow inicializado, com os mesmos nomes de branch que o Claude
 *    e a trava de branch (`branch-guard.sh`) usam — sem ninguém precisar clicar em
 *    "Initialize" e escolher prefixo à mão, que é onde uma máquina acaba com `master` e outra
 *    com `main`.
 * 2. O template de mensagem de commit (`.gitmessage`) aparece no editor.
 *
 * Só grava o que ainda não existe: quem já configurou diferente na própria máquina não é
 * sobrescrito. Sem git (projeto baixado em .zip), não faz nada.
 */
import { execFileSync } from 'node:child_process';

const SETTINGS = {
  'gitflow.branch.master': 'main',
  'gitflow.branch.develop': 'develop',
  'gitflow.prefix.feature': 'feature/',
  'gitflow.prefix.bugfix': 'bugfix/',
  'gitflow.prefix.release': 'release/',
  'gitflow.prefix.hotfix': 'hotfix/',
  'gitflow.prefix.support': 'support/',
  'gitflow.prefix.versiontag': 'v',
  'commit.template': '.gitmessage',
};

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function isInsideRepository() {
  try {
    return git(['rev-parse', '--is-inside-work-tree']) === 'true';
  } catch {
    return false;
  }
}

function readLocal(key) {
  try {
    return git(['config', '--local', '--get', key]);
  } catch {
    return '';
  }
}

if (isInsideRepository()) {
  for (const [key, value] of Object.entries(SETTINGS)) {
    if (readLocal(key) !== '') continue;
    git(['config', '--local', key, value]);
  }
}
