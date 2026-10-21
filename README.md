# Biblioteca Horizonte

Sistema de gestão de biblioteca com interface web, API ASP.NET Core 8 e PostgreSQL.

## Executar localmente

1. Instale o **.NET 8 SDK** e o **PostgreSQL 14 ou superior**.
2. Crie o banco, as tabelas e os dados iniciais:

   ```powershell
   psql -U postgres -f database/biblioteca.sql
   ```

3. Na raiz do projeto, configure a conexão do banco na sessão atual do PowerShell:

   ```powershell
   $env:PATH = "$env:USERPROFILE\.dotnet;$env:PATH"
   $env:BIBLIOTECA_DB = "Host=localhost;Port=5432;Database=biblioteca_horizonte;Username=postgres;Password=SUA_SENHA"
   dotnet run --project Biblioteca.Api.csproj
   ```

   A primeira linha também permite usar o SDK instalado no perfil do usuário; se o .NET SDK já estiver no `PATH`, ela é inofensiva.

4. Abra no navegador o endereço HTTPS/HTTP que o `dotnet run` informar. A página e a API são hospedadas na mesma origem.

O usuário inicial do banco é `bibliotecario@biblioteca.local`, com a senha demonstrativa `Leitura123!`. Para entrar na interface, informe `bibliotecario` e essa senha. Altere/remova a credencial inicial antes de disponibilizar qualquer ambiente fora da máquina local.

> Não abra `wwwroot/index.html` diretamente como arquivo: a interface precisa acessar a API hospedada pelo backend.

## API

Todas as operações do acervo exigem uma sessão autenticada. O login cria um cookie de sessão `HttpOnly`, `SameSite=Strict`, com expiração após 30 minutos de inatividade. As alterações de livros e empréstimos são persistidas no PostgreSQL.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/health` | Público | Confere a conexão com o banco. |
| `POST` | `/api/auth/login` | Público | Autentica com usuário/senha e inicia a sessão. |
| `GET` | `/api/auth/me` | Sessão | Retorna o usuário da sessão atual. |
| `POST` | `/api/auth/logout` | Sessão | Encerra a sessão. |
| `GET` | `/api/categories` | Sessão | Lista categorias cadastradas. |
| `GET` | `/api/books?search=texto` | Sessão | Lista/pesquisa livros e disponibilidade. |
| `POST` | `/api/books` | Sessão | Cadastra livro; valida ISBN e exemplares. |
| `GET` | `/api/loans?status=ativo` | Sessão | Lista empréstimos; filtro opcional `ativo` ou `devolvido`. |
| `POST` | `/api/loans` | Sessão | Registra empréstimo de exemplar disponível. |
| `POST` | `/api/loans/{id}/return` | Sessão | Registra devolução de empréstimo ativo. |

Exemplo de autenticação:

```json
{
  "username": "bibliotecario",
  "password": "Leitura123!"
}
```

Exemplo para cadastrar um livro:

```json
{
  "title": "Livro de exemplo",
  "author": "Autoria de exemplo",
  "category": "Literatura",
  "isbn": "9781234567890",
  "copies": 2
}
```

## Estrutura

```text
.
├── Biblioteca.Api.csproj
├── Program.cs
├── database/
│   └── biblioteca.sql
├── docs/
│   ├── API.md
│   ├── CASOS_DE_TESTE.md
│   ├── DER.svg
│   ├── INFRAESTRUTURA.md
│   └── REQUISITOS_FUNCIONAIS.md
└── wwwroot/
    ├── app.js
    ├── index.html
    └── styles.css
```

## Segurança e limites

- A senha inicial é apenas para desenvolvimento; troque-a antes de usar dados reais.
- A senha é verificada pelo PostgreSQL com `pgcrypto`; credenciais do banco devem ficar em variável de ambiente/cofre e nunca no repositório.
- O login limita tentativas por endereço IP. Sessões e operações sensíveis são validadas no backend.
- Configure HTTPS e armazenamento compartilhado/seguro para sessões ao implantar múltiplas instâncias. A sessão em memória é própria para desenvolvimento e invalida sessões quando o processo reinicia.
