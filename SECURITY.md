# Security Policy

## 🔒 Segurança e Boas Práticas

Este documento descreve as práticas de segurança adotadas no projeto e orientações para desenvolvedores e operadores.

## Gerenciamento de Credenciais

### ❌ O que NÃO fazer

- **Nunca** commite credenciais ou senhas em arquivos de código ou configuração
- **Nunca** compartilhe arquivos `.env` com credenciais reais em repositórios públicos ou privados
- **Nunca** use senhas fracas ou padrões como `admin`, `password`, `123456`

### ✅ O que fazer

1. **Use variáveis de ambiente**: Todas as credenciais devem estar em arquivos `.env` (ignorados pelo Git)
2. **Use `.env.example` como template**: Copie e renomeie para `.env`, depois preencha com valores reais
3. **Senhas fortes**: Use geradores de senha para criar credenciais robustas (16+ caracteres, misto de maiúsculas, minúsculas, números e símbolos)
4. **Rotação de credenciais**: Em produção, altere senhas periodicamente e após qualquer suspeita de comprometimento

## Configuração Segura (Desenvolvimento Local)

1. Copie o template de variáveis de ambiente:
```bash
cp .env.example .env
```

2. Edite o `.env` e altere TODAS as senhas padrão:
```bash
# Exemplo de senha forte (NÃO use esta, gere a sua própria)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
PGADMIN_DEFAULT_PASSWORD=$(openssl rand -base64 32)
```

3. Configure a `DATABASE_URL` com a senha escolhida:
```
DATABASE_URL=postgresql://challenge:SUA_SENHA_FORTE@postgres:5432/challenge_db
```

4. Nunca commite o arquivo `.env`:
```bash
# Verifique antes de commit
git status
# O arquivo .env NÃO deve aparecer na lista
```

## Configuração Segura (Azure/Produção)

### Azure Key Vault (Recomendado)

Para ambientes de produção, use **Azure Key Vault** para armazenar credenciais:

1. Crie um Key Vault:
```bash
az keyvault create --name nola-keyvault --resource-group nola-rg --location eastus2
```

2. Armazene secrets:
```bash
az keyvault secret set --vault-name nola-keyvault --name "DatabasePassword" --value "SENHA_FORTE_AQUI"
az keyvault secret set --vault-name nola-keyvault --name "DatabaseConnectionString" --value "postgresql://..."
```

3. Configure Container Apps para usar Key Vault:
```bash
az containerapp secret set \
  --name nola-backend \
  --resource-group nola-rg \
  --secrets "database-url=keyvaultref:https://nola-keyvault.vault.azure.net/secrets/DatabaseConnectionString,identityref:/subscriptions/.../managed-identity"
```

### GitHub Secrets (CI/CD)

Para workflows do GitHub Actions, use **GitHub Secrets**:

1. Acesse: `Settings` → `Secrets and variables` → `Actions`
2. Adicione secrets:
   - `DATABASE_URL`
   - `AZURE_CREDENTIALS`
   - `POSTGRES_PASSWORD`
   - Etc.

3. Nos workflows, referencie via `${{ secrets.SECRET_NAME }}`

**Nunca** imprima secrets em logs:
```yaml
# ❌ ERRADO
- name: Debug
  run: echo "Database URL: ${{ secrets.DATABASE_URL }}"

# ✅ CORRETO
- name: Deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: |
    # Usa a variável sem exibi-la
    az containerapp update --set-env-vars "DATABASE_URL=$DATABASE_URL"
```

## Checklist de Segurança

Antes de fazer deploy ou compartilhar código:

- [ ] `.env` está no `.gitignore`?
- [ ] Não há credenciais hardcoded no código?
- [ ] Senhas são fortes (16+ caracteres)?
- [ ] Secrets estão configurados no GitHub Actions?
- [ ] Produção usa Key Vault ou serviço equivalente?
- [ ] CORS está restrito aos domínios corretos (não usar `*` em produção)?
- [ ] SSL/TLS está habilitado para comunicação com banco?
- [ ] Logs não expõem informações sensíveis?

## Vulnerabilidades Conhecidas Corrigidas

### 2025-11-15: Credenciais hardcoded no docker-compose.yml

**Problema**: Senhas e connection strings estavam hardcoded no `docker-compose.yml`, sendo commitadas no repositório.

**Solução**: 
- Refatorado `docker-compose.yml` para usar variáveis de ambiente
- Criado `.env.example` como template
- Documentadas boas práticas neste arquivo

**Impacto**: Baixo (desenvolvimento local), mas crítico se exposto publicamente.

## Reportar Vulnerabilidades

Se você encontrar uma vulnerabilidade de segurança:

1. **NÃO** abra uma issue pública
2. Envie email para: [seu-email-seguranca@example.com]
3. Inclua:
   - Descrição detalhada da vulnerabilidade
   - Steps to reproduce
   - Impacto potencial
   - Sugestão de correção (se possível)

Responderemos em até 48 horas e trabalharemos para corrigir o problema antes de divulgação pública.

## Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Azure Security Best Practices](https://learn.microsoft.com/en-us/azure/security/fundamentals/best-practices-and-patterns)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
- [12-Factor App: Config](https://12factor.net/config)

---

**Última atualização**: 2025-11-15
