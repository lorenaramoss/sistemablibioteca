# Requisitos funcionais — Biblioteca Horizonte

## Objetivo e escopo

O sistema apoia as atividades básicas de uma biblioteca: autenticação de bibliotecário, consulta e cadastro de livros e acompanhamento de empréstimos. A interface web usa uma API ASP.NET Core para autenticar usuários e persistir os dados no PostgreSQL.

## Atores

| Ator | Descrição |
|---|---|
| Bibliotecário | Acessa o sistema, consulta o acervo, cadastra livros e administra empréstimos. |

## Requisitos funcionais

| ID | Requisito | Prioridade |
|---|---|---|
| RF-01 | O sistema deve permitir que o bibliotecário informe usuário e senha para acessar a interface. | Alta |
| RF-02 | O sistema deve rejeitar credenciais inválidas e informar o resultado sem revelar qual campo está incorreto. | Alta |
| RF-03 | O sistema deve permitir encerrar a sessão e retornar à tela de autenticação. | Alta |
| RF-04 | O sistema deve apresentar no painel a quantidade de títulos, exemplares disponíveis, empréstimos ativos e empréstimos em atraso. | Alta |
| RF-05 | O sistema deve listar os livros cadastrados com título, autor, categoria, ISBN e quantidade total de exemplares. | Alta |
| RF-06 | O sistema deve permitir pesquisar livros por título, autor, categoria ou ISBN. | Média |
| RF-07 | O sistema deve permitir cadastrar livros informando título, autor, categoria, ISBN e quantidade de exemplares. | Alta |
| RF-08 | O sistema deve validar os campos obrigatórios, o ISBN e a quantidade positiva antes de salvar um livro. | Alta |
| RF-09 | O sistema deve impedir o cadastro de livros com ISBN já existente. | Alta |
| RF-10 | O sistema deve permitir registrar um empréstimo para um livro disponível, identificando o nome do leitor e a data de devolução prevista. | Alta |
| RF-11 | O sistema deve impedir empréstimo quando não houver exemplar disponível. | Alta |
| RF-12 | O sistema deve listar empréstimos ativos e devolvidos com leitor, livro, data de empréstimo, vencimento e situação. | Alta |
| RF-13 | O sistema deve permitir registrar a devolução de um empréstimo ativo e atualizar a disponibilidade do acervo. | Alta |
| RF-14 | O sistema deve identificar empréstimos vencidos que ainda não foram devolvidos. | Média |
| RF-15 | O sistema deve persistir livros e empréstimos no PostgreSQL, permitindo consultar os mesmos registros em sessões e navegadores autorizados. | Alta |

## Regras de negócio

1. Cada ISBN identifica um único título.
2. A quantidade de exemplares deve ser um número inteiro maior que zero.
3. Um empréstimo só pode ser aberto se houver exemplar disponível.
4. A data prevista de devolução deve ser posterior à data do empréstimo.
5. Um empréstimo devolvido não pode ser devolvido novamente.
6. A disponibilidade é calculada como exemplares totais menos empréstimos ativos.
7. A senha deve ser verificada no servidor; a credencial inicial fornecida pelo script é exclusiva para desenvolvimento e deve ser alterada antes da implantação.

## Requisitos não funcionais relacionados

- A interface deve adaptar-se a telas de celular, tablet e desktop.
- A navegação e os formulários devem ser utilizáveis por teclado.
- Mensagens de validação e confirmação devem ser apresentadas em português.
- Dados pessoais de leitores não devem ser enviados a terceiros.
- O sistema exige backend e banco de dados disponíveis; sessões e operações de dados devem ser protegidas no servidor.
