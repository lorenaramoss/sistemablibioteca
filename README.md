# Biblioteca Horizonte

Sistema demonstrativo de biblioteca para cadastro e consulta de livros e gestão de empréstimos. A interface funciona no navegador sem dependências externas e salva os dados de demonstração no `localStorage` do navegador.

## Executar

Abra `index.html` em um navegador moderno. Para testar a autenticação, use:

- **Usuário:** `bibliotecario`
- **Senha:** `Leitura123!`

Após entrar, use o menu lateral para consultar o painel, cadastrar livros e registrar ou devolver empréstimos. Os dados ficam apenas no navegador em uso; o script PostgreSQL em `database/biblioteca.sql` é a base para uma futura integração com servidor.

> **Aviso:** autenticação e persistência no navegador são exclusivamente demonstrativas. Não use este protótipo para armazenar dados reais nem exponha credenciais de produção no código do cliente.

## Entregáveis

1. [Requisitos funcionais (Word)](docs/REQUISITOS_FUNCIONAIS.docx) e [versão-fonte em Markdown](docs/REQUISITOS_FUNCIONAIS.md)
2. [Diagrama entidade-relacionamento (SVG)](docs/DER.svg)
3. [Criação e população do banco de dados](database/biblioteca.sql)
4. [Casos de teste de software](docs/CASOS_DE_TESTE.md)
5. [Requisitos de infraestrutura](docs/INFRAESTRUTURA.md)
6. Interface de autenticação e telas do sistema: `index.html`, `styles.css` e `app.js`

## Banco de dados

O script foi escrito para PostgreSQL 14 ou superior. Execute com uma conta autorizada a criar o banco:

```powershell
psql -U postgres -f database/biblioteca.sql
```

O script cria o banco `biblioteca_horizonte`, as tabelas, uma visão de disponibilidade e registros iniciais. A senha do usuário de demonstração no banco é gerada como hash com `pgcrypto`; não é a autenticação da interface estática.

## Estrutura

```text
.
├── app.js
├── database/
│   └── biblioteca.sql
├── docs/
│   ├── CASOS_DE_TESTE.md
│   ├── DER.svg
│   ├── INFRAESTRUTURA.md
│   └── REQUISITOS_FUNCIONAIS.md
├── index.html
├── README.md
└── styles.css
```
