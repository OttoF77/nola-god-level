# Configurar GitHub Secrets para CI/CD

Para ativar o deploy automático via GitHub Actions, você precisa adicionar os seguintes secrets no seu repositório.

## 📋 Como Adicionar Secrets

1. Acesse seu repositório no GitHub: https://github.com/OttoF77/nola-god-level
2. Vá em: **Settings → Secrets and variables → Actions**
3. Clique em **New repository secret**
4. Adicione cada secret abaixo

---

## 🔑 Secrets Necessários

### 1. AZURE_STATIC_WEB_APPS_API_TOKEN
**Descrição**: Token de deploy do Static Web App (frontend)

**Valor**:
```
dc060a583f74e92a70033eb4d0f5c9a2adeae328523007d365b78487540797a403-505b9176-71ff-4514-88e3-645c7f3793e900f190203524520f
```

**Como usar**: Permite GitHub Actions fazer deploy do frontend no Azure Static Web Apps

---

### 2. DOCKER_USERNAME
**Descrição**: Seu username do Docker Hub

**Valor**:
```
ottof77
```

**Como usar**: Login no Docker Hub para push de imagens

---

### 3. DOCKER_PASSWORD
**Descrição**: Sua senha do Docker Hub

**Valor**: `[SUA SENHA DO DOCKER HUB]`

**Como obter**: 
- Sua senha normal do Docker Hub
- OU criar um Access Token em: https://hub.docker.com/settings/security

**Como usar**: Autenticação no Docker Hub

---

### 4. AZURE_CREDENTIALS
**Descrição**: Credenciais do Service Principal para Azure CLI

**Como obter**:
```bash
az ad sp create-for-rbac \
  --name "github-actions-nola" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/nola-rg \
  --sdk-auth
```

**Valor**: Copie o JSON completo retornado pelo comando acima (exemplo):
```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "67a82fa9-996a-4794-8e7f-619df1088c7c",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

**Como usar**: Permite GitHub Actions executar comandos Azure CLI

---

## ✅ Verificar Secrets

Após adicionar todos os secrets, você deverá ver:
- ✅ AZURE_STATIC_WEB_APPS_API_TOKEN
- ✅ DOCKER_USERNAME
- ✅ DOCKER_PASSWORD
- ✅ AZURE_CREDENTIALS

---

## 🚀 Testar Deploy

Depois de configurar os secrets:

1. **Fazer push de qualquer mudança:**
   ```bash
   git add .
   git commit -m "test: ativar CI/CD"
   git push origin main
   ```

2. **Acompanhar workflows:**
   - Acesse: https://github.com/OttoF77/nola-god-level/actions
   - Veja os workflows **Backend Deploy** e **Frontend Deploy** executando

3. **Verificar deploy:**
   - Backend: https://nola-dev-backend.niceocean-7209230a.eastus2.azurecontainerapps.io/health
   - Frontend: https://gentle-beach-03524520f.3.azurestaticapps.net

---

## 🐛 Troubleshooting

### Erro: "Resource 'Microsoft.Web/staticSites' under resource group 'nola-rg' was not found"
- Certifique-se que o Static Web App foi criado
- Verifique o nome do resource group no workflow

### Erro: "Error: Docker login failed"
- Verifique se DOCKER_USERNAME e DOCKER_PASSWORD estão corretos
- Tente usar Access Token do Docker Hub no lugar da senha

### Erro: "AuthorizationFailed"
- Execute novamente o comando `az ad sp create-for-rbac` para gerar novas credenciais
- Copie o JSON completo no secret AZURE_CREDENTIALS

---

## 📊 Resumo do Fluxo CI/CD

```
┌─────────────────┐
│  git push main  │
└────────┬────────┘
         │
    ┌────▼─────────────────────────────────────┐
    │  GitHub Actions detecta mudanças         │
    └────┬─────────────────────────────────────┘
         │
    ┌────▼─────────┐        ┌─────────────────┐
    │  Backend?    │───Sim─▶│ Build Docker    │
    │  (backend/*) │        │ Push Docker Hub │
    └────┬─────────┘        │ Update Azure    │
         │                  └─────────────────┘
         Não
         │
    ┌────▼─────────┐        ┌─────────────────┐
    │  Frontend?   │───Sim─▶│ Build React     │
    │  (frontend/*) │       │ Deploy SWA      │
    └──────────────┘        └─────────────────┘
```

---

## 🎯 Próximos Passos

1. ✅ Adicionar os 4 secrets no GitHub
2. ✅ Fazer um commit de teste
3. ✅ Verificar workflows executando
4. ✅ Acessar frontend e testar aplicação completa
