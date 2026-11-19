#!/usr/bin/env sh
#
# THE PROJECT BRANCH GUARD.
#
# Runs in the git hooks (pre-commit, pre-merge-commit, pre-push), so it applies to everyone:
# terminal, Claude and Tower. It refuses:
#
#   main        → commit, merge and push. main belongs to the admin.
#   develop     → direct commits. It only receives finished features, by merge.
#
# The admin unlocks their own machine ONCE, and only it:
#
#   git config project.admin true
#
# The setting lives in that clone's `.git/config` and is not versioned, so it never leaks to
# anyone else's machine.
#
# The printed messages are for people who do NOT code: what happened and what to do, no jargon.
# They stay in Portuguese because people read them. Ported from acerola-sync.

action="$1"

if [ "$(git config --get project.admin 2>/dev/null)" = "true" ]; then
  exit 0
fi

branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null)
git_dir=$(git rev-parse --git-dir 2>/dev/null)

refuse() {
  printf '\n' >&2
  printf '  ✋ %s\n' "$1" >&2
  printf '\n' >&2
  printf '  %s\n' "$2" >&2
  printf '\n' >&2
  printf '  Nada foi perdido: suas alterações continuam aqui.\n' >&2
  printf '\n' >&2
  exit 1
}

case "$action" in
  commit)
    if [ "$branch" = "main" ]; then
      refuse \
        'A branch "main" é protegida. Ninguém salva alterações direto nela.' \
        'Peça ao Claude: "começa uma feature de <o que você está fazendo>". Ele cria a branch certa e leva as alterações junto.'
    fi

    # Finishing a merge in progress is allowed: it is the feature merge arriving.
    if [ "$branch" = "develop" ] && [ ! -f "$git_dir/MERGE_HEAD" ]; then
      refuse \
        'Na branch "develop" só entram funcionalidades prontas, por merge.' \
        'Peça ao Claude: "começa uma feature de <o que você está fazendo>". Ele cria a branch certa e leva as alterações junto.'
    fi
    ;;

  merge)
    if [ "$branch" = "main" ]; then
      refuse \
        'Juntar alterações na "main" é tarefa de quem administra o projeto.' \
        'As funcionalidades terminam na "develop". Peça ao Claude: "terminei, pode juntar na develop".'
    fi
    ;;

  push)
    # git sends one line per pushed ref: <local> <sha> <remote> <sha>.
    while read -r _local_ref _local_sha remote_ref _remote_sha; do
      if [ "$remote_ref" = "refs/heads/main" ]; then
        refuse \
          'Enviar para a "main" é tarefa de quem administra o projeto.' \
          'Envie a "develop" ou a sua branch de feature. Peça ao Claude: "envia a develop".'
      fi
    done
    ;;
esac

exit 0
