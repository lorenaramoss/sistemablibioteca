# Requisitos de infraestrutura

## Ambiente local da aplicação

| Componente | Requisito |
|---|---|
| Cliente | Navegador atualizado com suporte a HTML5, CSS Grid, JavaScript ES6 e cookies de sessão (Chrome, Edge, Firefox ou Safari atuais). |
| Dispositivo | Desktop, tablet ou celular; viewport mínimo recomendado de 320 px. |
| Backend | .NET 8 SDK para desenvolvimento; a aplicação usa ASP.NET Core e Npgsql para acessar o banco. |
| Banco de dados | PostgreSQL 14 ou superior, com extensão `pgcrypto` habilitada pelo script. |
| Hospedagem | Backend ASP.NET Core; a aplicação serve a interface estática de `wwwroot` e as rotas `/api` na mesma origem. |
| Segredos | `BIBLIOTECA_DB` configurada no ambiente do servidor; não manter a connection string no frontend ou no Git. |
| Sessões | Cache de sessão em memória para desenvolvimento local; exige armazenamento distribuído e chaves compartilhadas ao escalar para várias instâncias. |

## Ambiente de produção

| Componente | Requisito recomendado |
|---|---|
| Banco de dados | PostgreSQL 14 ou superior, com extensão `pgcrypto` habilitada para a verificação da senha. |
| Servidor de aplicação | ASP.NET Core 8 com API e frontend hospedados na mesma origem, atrás de HTTPS válido. |
| Rede | TLS válido, acesso ao banco restrito ao servidor da aplicação e firewall permitindo somente portas necessárias. |
| Segredos | Credenciais de banco e chaves armazenadas em cofre/variáveis seguras, nunca no frontend ou no repositório. |
| Backup | Backup automatizado e política de retenção definida; testar restauração periodicamente. |
| Observabilidade | Registro de erros e monitoramento de disponibilidade sem armazenar senhas ou dados pessoais desnecessários nos logs. |

## Limites e segurança

O backend incluído usa sessão em memória e um usuário inicial de demonstração. Troque a senha inicial, use HTTPS, configure armazenamento compartilhado de sessão antes de executar múltiplas instâncias e aplique gestão de segredos, backup e política de privacidade antes do uso real.
