# 🧪 Guia Completo de Testes Frontend

Este documento explica como usar **Jest** (testes unitários) e **Cypress** (testes E2E) no projeto frontend, similar ao pytest do backend.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Testes Unitários com Jest](#testes-unitários-com-jest)
3. [Testes E2E com Cypress](#testes-e2e-com-cypress)
4. [Como Rodar Testes](#como-rodar-testes)
5. [Escrevendo Novos Testes](#escrevendo-novos-testes)
6. [Boas Práticas](#boas-práticas)

---

## 🎯 Visão Geral

| Ferramenta | Tipo | O que testa | Velocidade |
|-----------|------|-----------|-----------|
| **Jest** | Unitário | Funções, hooks, componentes isolados | ⚡ Muito rápido |
| **React Testing Library** | Integração | Componentes e interações do usuário | ⚡ Mediano |
| **Cypress** | E2E | Fluxos completos (login, criar contas) | 🐢 Mais lento |

---

## 🧬 Testes Unitários com Jest

### O que é Jest?

Jest é um framework de testes para JavaScript/TypeScript que:
- ✅ Testa funções, hooks e componentes isolados
- ✅ Valida formatadores, validadores, utilitários
- ✅ Roda muito rápido (em segundos)
- ✅ Tem cobertura de código automática
- ✅ Funciona com TypeScript nativamente

### Estrutura de Testes

Os testes estão em `src/__tests__/`:

```
src/__tests__/
├── lib/
│   ├── cpfFormatter.test.ts      # Testa validação de CPF
│   ├── phoneFormatter.test.ts    # Testa formatação de telefone
│   └── currencyFormatter.test.ts # Testa formatação de moeda
├── components/
│   └── Toastifier.test.tsx       # Testa componente Toast
└── services/
    ├── auth.service.test.ts      # Testa serviço de auth (placeholder)
    └── expense.service.test.ts   # Testa serviço de despesas (placeholder)
```

### Executar Testes Unitários

**Rodar todos os testes:**
```bash
cd app/frontend
npm test
```

**Modo watch (rerun ao salvar):**
```bash
npm run test:watch
```

**Gerar relatório de cobertura:**
```bash
npm run test:coverage
```

**Rodar teste específico:**
```bash
npm test cpfFormatter
```

### Exemplo: Entendendo um Teste

```typescript
describe('CPF Formatter', () => {
  describe('validateCPF', () => {
    it('should validate correct CPF', () => {
      // Arrange: preparar dados
      const validCPF = '11144477735'
      
      // Act: executar função
      const result = validateCPF(validCPF)
      
      // Assert: verificar resultado
      expect(result).toBe(true)
    })

    it('should reject invalid CPF', () => {
      expect(validateCPF('11111111111')).toBe(false)
      expect(validateCPF('00000000000')).toBe(false)
    })
  })
})
```

**Padrão: AAA**
- **Arrange:** Preparar dados de teste
- **Act:** Executar a função
- **Assert:** Verificar o resultado

---

## 🌐 Testes E2E com Cypress

### O que é Cypress?

Cypress testa a aplicação **completa** como um usuário real:
- ✅ Login e autenticação
- ✅ Criar despesas e parcelas
- ✅ Gerenciar usuários
- ✅ Fluxos completos de negócio
- ✅ Responsividade em diferentes telas

### Estrutura de Testes E2E

Os testes estão em `cypress/e2e/`:

```
cypress/
├── e2e/
│   ├── login.cy.js           # Testa login
│   ├── expenses.cy.js        # Testa criação/edição de despesas
│   ├── users.cy.js           # Testa gerenciamento de usuários
│   └── navigation.cy.js      # Testa navegação e responsividade
├── support/
│   ├── commands.js           # Comandos customizados (login, fillForm)
│   └── e2e.js                # Configuração global
└── cypress.config.js         # Configuração do Cypress
```

### Executar Testes E2E

**Abrir Cypress interativo (melhor para development):**
```bash
cd app/frontend
npm run e2e
```

**Rodar testes E2E headless:**
```bash
npm run e2e:run
```

**Rodar teste específico:**
```bash
npm run e2e:run -- --spec "cypress/e2e/login.cy.js"
```

### Exemplo: Entendendo um Teste E2E

```typescript
describe('Login Flow', () => {
  beforeEach(() => {
    // Roda antes de cada teste
    cy.visit('/login')
  })

  it('should login successfully', () => {
    // Preencher formulário
    cy.get('input[type="email"]').type('admin@example.com')
    cy.get('input[type="password"]').type('admin123')
    
    // Enviar formulário
    cy.get('button[type="submit"]').click()
    
    // Verificar que redirecionou
    cy.url().should('include', '/dashboard')
  })
})
```

### Seletores Cypress Comuns

```typescript
// Por tipo
cy.get('input[type="email"]')
cy.get('button[type="submit"]')

// Por texto
cy.contains('Login').click()
cy.contains('Usuário criado com sucesso').should('be.visible')

// Por classe/ID
cy.get('.modal-title')
cy.get('#submit-button')

// Por 'name' (formulários)
cy.get('input[name="email"]')

// Hierarquia
cy.get('form').within(() => {
  cy.get('input[type="email"]').type('test@example.com')
})
```

---

## 🚀 Como Rodar Testes

### Checklist Completo

```bash
# 1. Instalar dependências (já feito)
npm install

# 2. Rodar testes unitários
npm test

# 3. Ver cobertura
npm run test:coverage

# 4. Rodar testes E2E (precisa da app rodando)
npm run dev          # Em outro terminal
npm run e2e          # Cypress interativo
# ou
npm run e2e:run      # Modo headless
```

### CI/CD (GitHub Actions)

Para rodar testes automaticamente em push:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run e2e:run
```

---

## 📝 Escrevendo Novos Testes

### Teste Unitário - CPF Formatter

Criar: `src/__tests__/lib/cpfFormatter.test.ts`

```typescript
import { validateCPF } from '@/lib/cpfFormatter'

describe('CPF Validator', () => {
  it('should validate correct CPF', () => {
    expect(validateCPF('11144477735')).toBe(true)
  })

  it('should reject invalid CPF', () => {
    expect(validateCPF('11111111111')).toBe(false)
  })

  it('should reject short CPF', () => {
    expect(validateCPF('123')).toBe(false)
  })
})
```

**Rodar:**
```bash
npm test cpfFormatter
```

### Teste de Componente - Button

Criar: `src/__tests__/components/Button.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Button Component', () => {
  it('should render button', () => {
    render(<button>Click me</button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('should call onClick handler', async () => {
    const handleClick = jest.fn()
    render(<button onClick={handleClick}>Click me</button>)
    
    await userEvent.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalled()
  })
})
```

### Teste E2E - Criar Despesa

Criar: `cypress/e2e/create-expense.cy.js`

```typescript
describe('Create Expense', () => {
  beforeEach(() => {
    cy.login('admin@example.com', 'admin123')
    cy.visit('/dashboard/expenses')
  })

  it('should create expense with installments', () => {
    cy.contains('Nova Despesa').click()
    
    cy.get('input[placeholder*="Descrição"]').type('Aluguel')
    cy.get('input[placeholder*="Valor"]').type('1200.00')
    cy.get('input[type="date"]').type('2026-03-01')
    cy.get('input[type="checkbox"]').check()
    cy.get('input[type="number"]').type('3')
    
    cy.get('button[type="submit"]').click()
    
    cy.contains('3 parcelas criadas com sucesso').should('be.visible')
  })
})
```

---

## ✅ Boas Práticas

### 1. Testes Rápidos

```typescript
// ✅ BOM - Testa só a função
it('should format CPF', () => {
  expect(formatCPF('11144477735')).toBe('111.444.777-35')
})

// ❌ RUIM - Testa o banco de dados também
it('should create user', async () => {
  const user = await api.post('/users', { ... })
  expect(user).toBeDefined()
})
```

### 2. Nomes Descritivos

```typescript
// ✅ BOM
it('should validate CPF with correct digits', () => { ... })

// ❌ RUIM  
it('should work', () => { ... })
```

### 3. Teste um Cenário por Teste

```typescript
// ✅ BOM
it('should accept valid CPF', () => {
  expect(validateCPF('11144477735')).toBe(true)
})

it('should reject invalid CPF', () => {
  expect(validateCPF('11111111111')).toBe(false)
})

// ❌ RUIM
it('should validate CPF', () => {
  expect(validateCPF('11144477735')).toBe(true)
  expect(validateCPF('11111111111')).toBe(false)
  expect(formatCPF('11144477735')).toBe('111.444.777-35')
})
```

### 4. Setup/Teardown

```typescript
describe('User Management', () => {
  let userId

  beforeEach(() => {
    // Roda antes de cada teste
    cy.login('admin@example.com', 'admin123')
  })

  afterEach(() => {
    // Roda após cada teste
    cy.clearCookies()
  })

  it('should create user', () => {
    // ... teste
  })
})
```

### 5. Mock de API

```typescript
it('should handle network errors', () => {
  cy.intercept('POST', '/api/expenses', { statusCode: 500 })
  cy.visit('/dashboard/expenses')
  cy.contains('Nova Despesa').click()
  cy.get('button[type="submit"]').click()
  cy.contains('Erro ao salvar').should('be.visible')
})
```

---

## 📊 Cobertura de Testes

Ver quais arquivos têm testes:

```bash
npm run test:coverage
```

Resultado:
```
File                      Statements   Branches   Functions   Lines
--------------------------------------------------------------------
All files                  85.2%        72.1%      88.9%      85.1%
lib/cpfFormatter.ts       100%         100%       100%        100%
lib/phoneFormatter.ts     100%         100%       100%        100%
components/Toastifier    87.3%        75.2%      92.1%        87.9%
```

**Meta recomendada:** >= 80% de cobertura

---

## 🔍 Debugging Testes

### Jest

```bash
# Debug interativo
node --inspect-brk node_modules/.bin/jest --runInBand

# Mais verbose
npm test -- --verbose
```

### Cypress

```bash
# Modo debug (pausas entre comandos)
npm run e2e:run -- --headed --debug

# Modo interativo com inspector
npm run e2e
# Depois click em "Specs" > seu teste
```

---

## 📚 Links Úteis

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library Docs](https://testing-library.com/react)
- [Cypress Documentation](https://docs.cypress.io/)
- [Testing Best Practices](https://testingjavascript.com/)

---

## 🎉 Resumo

| Situação | Comando |
|----------|---------|
| Rodar testes rápidos | `npm test` |
| Modo watch desenvolvimento | `npm run test:watch` |
| Cobertura de código | `npm run test:coverage` |
| Testes E2E interativo | `npm run e2e` |
| Testes E2E headless | `npm run e2e:run` |
| Teste específico | `npm test cpfFormatter` |

**Próximos passos:**
- ✅ Jest + React Testing Library configurados
- ✅ Cypress configurado
- ✅ 25 testes iniciais criados
- 📝 Criar mais testes conforme o projeto cresce
- 🔄 Integrar com CI/CD (GitHub Actions)

Happy testing! 🚀
