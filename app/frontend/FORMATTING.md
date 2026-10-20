## 🎨 Frontend (TypeScript/JavaScript) - Prettier e ESLint

### O que é Prettier?

**Prettier** é um formatador automático que garante consistência no código:
- Indentação
- Quebras de linha
- Aspas simples vs duplas
- Ponto-e-vírgula
- Tamanho máximo de linha

### O que é ESLint?

**ESLint** é um linter que detecta erros e problemas:
- Variáveis não utilizadas
- Padrões de código
- Possíveis bugs
- Regras de qualidade

### Instalação

Já está configurado no projeto. Para reinstalar dependências:

```bash
cd app/frontend
npm install
```

### Verificar Erros (ESLint)

Para verificar problemas de qualidade:

```bash
cd app/frontend
npm run lint
```

### Formatar Código (Prettier)

**Formatar todos os arquivos:**
```bash
cd app/frontend
npm run format
```

**Apenas verificar (sem modificar):**
```bash
cd app/frontend
npm run format:check
```

### Configuração

**Prettier** - `.prettierrc.json`:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always"
}
```

### Exemplos Práticos

**Antes (sem formatação):**
```tsx
const handleSubmit=async(data:UserForm)=>{
  toast.success(  'Usuário criado com sucesso!'  )
  const result = await userService.create(data)
  return result
}
```

**Depois (depois de `npm run format`):**
```tsx
const handleSubmit = async (data: UserForm) => {
  toast.success('Usuário criado com sucesso!');
  const result = await userService.create(data);
  return result;
};
```

---

## 🚀 Boas Práticas

### Backend (Python)

1. **Sempre rodar Ruff antes de fazer commit:**
   ```bash
   ruff check . --fix
   ```

2. **Usar em modo watch (se disponível):**
   ```bash
   # Alguns IDEs suportam auto-run
   ```

3. **Integrar com Git hooks (opcional):**
   ```bash
   # Verifica antes de fazer commit
   ```

### Frontend (TypeScript/JavaScript)

1. **Formatar antes de fazer commit:**
   ```bash
   npm run format
   ```

2. **Verificar linting:**
   ```bash
   npm run lint
   ```

3. **VS Code - Configurar auto-format ao salvar:**
   - Instale extensão **Prettier - Code Formatter**
   - Instale extensão **ESLint**
   - Em `.vscode/settings.json`, adicione:
   ```json
   {
     "editor.formatOnSave": true,
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "[typescript]": {
       "editor.defaultFormatter": "esbenp.prettier-vscode"
     },
     "eslint.autoFixOnSave": true
   }
   ```

---

## 📊 Checklist Antes de Fazer Commit

- [ ] **Backend:** Rodou `ruff check . --fix`?
- [ ] **Frontend:** Rodou `npm run format`?
- [ ] **Frontend:** Rodou `npm run lint` (sem erros)?
- [ ] **Git:** Revisar arquivos modificados antes de push?
- [ ] **Testes:** Passou em todos os testes?

---

## 🔗 Links Úteis

- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [Prettier Documentation](https://prettier.io/)
- [ESLint Documentation](https://eslint.org/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**💡 Dica:** Configure seu VS Code para rodar essas ferramentas automaticamente ao salvar. Isso economiza tempo e evita problemas!
