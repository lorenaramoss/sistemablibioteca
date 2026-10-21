# Casos de teste de software

Os casos abaixo descrevem validações manuais para a interface do protótipo. Antes de cada caso, abra `index.html`; quando necessário, use **Sair** e entre novamente com `bibliotecario` / `Leitura123!`. A persistência de teste é local ao navegador.

| ID | Cenário | Pré-condições | Passos | Resultado esperado |
|---|---|---|---|---|
| CT-01 | Login válido | Tela de autenticação aberta | Informar `bibliotecario` e `Leitura123!`; selecionar **Entrar**. | Painel principal é exibido. |
| CT-02 | Login inválido | Tela de autenticação aberta | Informar senha incorreta e tentar entrar. | Acesso negado com mensagem de credenciais inválidas; tela permanece aberta. |
| CT-03 | Encerrar sessão | Usuário autenticado | Selecionar **Sair**. | Tela de login reaparece e as telas internas deixam de ser acessíveis pela navegação. |
| CT-04 | Exibir indicadores | Usuário autenticado; dados de demonstração carregados | Abrir **Visão geral**. | Indicadores de títulos, exemplares disponíveis, empréstimos ativos e atrasados são apresentados. |
| CT-05 | Pesquisar livro | Há livros no catálogo | Abrir **Acervo** e pesquisar por parte do título ou autor. | A lista mostra apenas resultados correspondentes; ao limpar a busca, todos os livros voltam a aparecer. |
| CT-06 | Cadastrar livro válido | ISBN ainda não cadastrado | Abrir **Acervo**, preencher todos os campos válidos e salvar. | Livro é incluído na lista e continua presente após recarregar a página. |
| CT-07 | Rejeitar campos inválidos | Formulário de livro aberto | Tentar salvar campos obrigatórios vazios ou quantidade igual a zero. | Formulário não é salvo e os campos inválidos são indicados. |
| CT-08 | Impedir ISBN duplicado | Livro com o ISBN informado já existe | Tentar cadastrar outro livro com o mesmo ISBN. | Cadastro é rejeitado com mensagem; nenhum duplicado aparece. |
| CT-09 | Abrir empréstimo | Existe pelo menos um exemplar disponível | Abrir **Empréstimos**, informar leitor, livro e vencimento futuro; salvar. | Empréstimo ativo aparece na lista e a disponibilidade do livro diminui em um exemplar. |
| CT-10 | Validar empréstimo sem leitor/livro | Formulário de empréstimo aberto | Tentar salvar sem selecionar livro ou informar leitor. | Empréstimo não é criado e a interface solicita os dados obrigatórios. |
| CT-11 | Registrar devolução | Existe empréstimo ativo | Selecionar **Devolver** no empréstimo. | Situação muda para devolvido e a disponibilidade do livro aumenta. |
| CT-12 | Calcular atraso | Há empréstimo com vencimento anterior à data atual | Consultar o painel e a lista de empréstimos. | Empréstimo é identificado como atrasado enquanto continuar ativo. |
| CT-13 | Impedir empréstimo sem disponibilidade | Todos os exemplares do livro estão emprestados | Tentar criar outro empréstimo do mesmo livro. | O livro não pode ser selecionado / empréstimo não pode ser salvo. |
| CT-14 | Adaptar a tela a celular | Navegador com viewport estreito (ex.: 375 px) | Abrir painel, catálogo e empréstimos. | Conteúdo permanece legível, sem rolagem horizontal da página; navegação continua utilizável. |

## Critérios de aceite

- CT-01 a CT-03 devem passar para considerar o fluxo de sessão demonstrativo utilizável.
- CT-06, CT-08, CT-09 e CT-11 devem passar para considerar os fluxos principais de acervo e empréstimo.
- Nenhum teste deve perder dados locais durante uma simples recarga da mesma origem/navegador.
- Executar também CT-14 em ao menos um navegador móvel ou emulador responsivo.
