/**
 * Padrão de commit do projeto:  [tipo](local): Mensagem
 *
 * O commitlint padrão espera Conventional Commits (`tipo(escopo): msg`), então o
 * cabeçalho é reinterpretado aqui por um parser próprio. Sem isto, TODO commit
 * no nosso formato seria rejeitado como "cabeçalho inválido".
 *
 * Quem escreve o commit, na prática, é o Claude — pela skill `git-commit`. Esta
 * configuração é a trava que não depende de ninguém lembrar da skill.
 */

/** @type {import('@commitlint/types').UserConfig} */
export default {
  parserPreset: {
    parserOpts: {
      // [feat](backend): Mensagem
      headerPattern: /^\[(\w+)\]\(([a-z-]+)\): (.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },

  /**
   * Commit de MERGE segue o formato como qualquer outro: `[merge](escopo): Mensagem`. O
   * fechamento de uma feature é a entrada mais importante do histórico — é ela que diz o que
   * passou a existir no sistema —, e deixá-la com o texto automático do git (`Merge branch
   * 'x' into develop`) desperdiça justamente a linha que alguém vai ler daqui a seis meses.
   *
   * Por isso `merge` entra na lista de tipos abaixo, e não existe mais exceção aqui.
   *
   * A consequência prática: merge precisa de `-m`. Um `git merge` ou `git pull` que gere a
   * mensagem sozinho vai ser recusado pelo hook — e recusar é o certo, porque é exatamente o
   * caso que se quer evitar.
   */

  rules: {
    'type-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'style', 'perf', 'build', 'ci', 'chore', 'merge'],
    ],

    'scope-empty': [2, 'never'],
    'scope-enum': [
      2,
      'always',
      ['backend', 'extension', 'db', 'docker', 'ci', 'docs', 'deps', 'claude'],
    ],

    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    // Desligado de propósito: a mensagem começa com maiúscula e pode conter
    // siglas (LTS, MVP, API), que qualquer regra de caixa reprovaria.
    'subject-case': [0],

    'header-max-length': [2, 'always', 100],
  },
};
