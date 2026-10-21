# Requisitos de infraestrutura

## Ambiente mínimo para executar o protótipo

| Componente | Requisito |
|---|---|
| Cliente | Navegador atualizado com suporte a HTML5, CSS Grid, JavaScript ES6 e `localStorage` (Chrome, Edge, Firefox ou Safari atuais). |
| Dispositivo | Desktop, tablet ou celular; viewport mínimo recomendado de 320 px. |
| Hospedagem | Qualquer servidor estático HTTPS (por exemplo, GitHub Pages, Nginx ou hospedagem equivalente); também é possível abrir `index.html` localmente. |
| Dependências | Nenhuma biblioteca ou serviço externo para as telas demonstrativas. |
| Armazenamento do protótipo | `localStorage` do navegador; os dados são isolados por navegador e origem e podem ser apagados pelo usuário. |

## Ambiente previsto para uma versão integrada

| Componente | Requisito recomendado |
|---|---|
| Banco de dados | PostgreSQL 14 ou superior, com extensão `pgcrypto` habilitada para o hash de senha da carga inicial. |
| Servidor de aplicação | API HTTPS em ambiente suportado pela equipe, com autenticação e autorização verificadas no servidor. |
| Rede | TLS válido, acesso ao banco restrito ao servidor da aplicação e firewall permitindo somente portas necessárias. |
| Segredos | Credenciais de banco e chaves armazenadas em cofre/variáveis seguras, nunca no frontend ou no repositório. |
| Backup | Backup automatizado e política de retenção definida; testar restauração periodicamente. |
| Observabilidade | Registro de erros e monitoramento de disponibilidade sem armazenar senhas ou dados pessoais desnecessários nos logs. |

## Limites e segurança

Esta entrega contém apenas frontend estático e script de banco, não contém API, implantação de banco nem pipeline de CI/CD. A autenticação fixa e a persistência local servem para demonstração e não oferecem controle de acesso real, sincronização entre usuários, backup ou proteção de dados. Para uso real, implementar backend com hash de senha seguro, sessões protegidas, validação no servidor, autorização, HTTPS, política de privacidade e gestão de backup.
