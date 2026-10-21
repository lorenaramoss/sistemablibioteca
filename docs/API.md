# API — Biblioteca Horizonte

A API é executada pela aplicação ASP.NET Core 8 na mesma origem das páginas da interface. Os dados são lidos e gravados no PostgreSQL. Os identificadores são strings decimais no JSON para evitar perda de precisão no navegador.

## Autenticação

`POST /api/auth/login` recebe `{"username":"bibliotecario","password":"..."}`. O usuário pode informar o nome de acesso (parte do e-mail anterior a `@`) ou o e-mail completo. Em caso de sucesso, o servidor estabelece uma sessão em cookie protegido por `HttpOnly`, `SameSite=Strict` e expiração após 30 minutos sem atividade. São permitidas cinco tentativas de login por minuto por IP.

`GET /api/auth/me` retorna o usuário atual. `POST /api/auth/logout` invalida a sessão. As rotas de categorias, livros e empréstimos respondem `401` quando não existe sessão válida.

## Recursos

### Livros

- `GET /api/books` — lista o acervo.
- `GET /api/books?search=machado` — busca por título, autor, categoria ou ISBN.
- `POST /api/books` — cria um livro:

```json
{
  "title": "Livro de exemplo",
  "author": "Autoria de exemplo",
  "category": "Literatura",
  "isbn": "9781234567890",
  "copies": 2
}
```

ISBN duplicado (inclusive com pontuação diferente), categoria desconhecida ou dados inválidos são rejeitados. A resposta de conflito de ISBN usa HTTP `409`.

### Empréstimos

- `GET /api/loans` — lista ativos e devolvidos.
- `GET /api/loans?status=ativo` ou `?status=devolvido` — filtra o estado.
- `POST /api/loans` — registra uma retirada:

```json
{
  "bookId": "1",
  "reader": "Nome do leitor",
  "due": "2026-11-04"
}
```

- `POST /api/loans/{id}/return` — devolve um empréstimo ativo.

A criação verifica a disponibilidade em uma transação que bloqueia a linha do livro, evitando emprestar o último exemplar simultaneamente a mais de uma pessoa. Uma retirada sem estoque responde HTTP `409`; empréstimo inexistente responde HTTP `404`.

## Respostas de erro

Erros de validação usam HTTP `400`, sessão ausente usa `401`, conflitos de estoque/ISBN usam `409` e login limitado usa `429`. Erros inesperados são registrados pelo ASP.NET Core e não retornam detalhes internos do banco ao cliente.

## Execução e configuração

Configure `BIBLIOTECA_DB` com uma connection string PostgreSQL antes de iniciar `dotnet run --project Biblioteca.Api.csproj`. O endpoint `GET /api/health` verifica a conexão com o banco.

O cookie de sessão usa o cache em memória padrão do ASP.NET Core; em produção com mais de uma instância, configure um armazenamento distribuído de sessões e proteja/compartilhe as chaves de Data Protection.
