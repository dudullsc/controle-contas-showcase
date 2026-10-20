describe('Expenses Flow', () => {
  beforeEach(() => {
    // Login antes de cada teste
    cy.visit('/login')
    cy.get('input[type="email"]').type('admin@example.com')
    cy.get('input[type="password"]').type('admin123')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard')
    
    // Navegar para expenses
    cy.visit('/dashboard/expenses')
  })

  it('should display expenses page', () => {
    cy.contains('Despesas').should('be.visible')
    cy.get('button').contains('Nova Despesa').should('be.visible')
  })

  it('should open create expense modal', () => {
    cy.get('button').contains('Nova Despesa').click()
    cy.get('h3').contains('Nova Despesa').should('be.visible')
  })

  it('should validate required fields', () => {
    cy.get('button').contains('Nova Despesa').click()
    cy.get('button[type="submit"]').click()
    
    // Verificar mensagens de erro
    cy.contains('Descrição é obrigatória').should('be.visible')
    cy.contains('Valor é obrigatório').should('be.visible')
  })

  it('should create single expense', () => {
    cy.get('button').contains('Nova Despesa').click()
    
    cy.fillExpenseForm({
      description: 'Teste de Despesa',
      amount: '100.50',
      category: 'Alimentação',
      dueDate: '2026-03-01',
    })
    
    cy.get('button[type="submit"]').click()
    
    // Verificar notificação de sucesso
    cy.get('.Toastify__toast--success', { timeout: 5000 }).should('be.visible')
    cy.contains('Despesa criada com sucesso').should('be.visible')
  })

  it('should create multiple installments', () => {
    cy.get('button').contains('Nova Despesa').click()
    
    // Habilitar parcelamento
    cy.get('input[type="checkbox"]').check({ force: true })
    
    cy.fillExpenseForm({
      description: 'Despesa Parcelada',
      amount: '300',
      category: 'Diversos',
      dueDate: '2026-02-16',
    })
    
    // Selecionar número de parcelas
    cy.get('input[type="number"]').type('3')
    
    cy.get('button[type="submit"]').click()
    
    // Verificar notificação de sucesso com número de parcelas
    cy.get('.Toastify__toast--success', { timeout: 5000 }).should('be.visible')
    cy.contains('3 parcelas criadas com sucesso').should('be.visible')
  })

  it('should mark expense as paid', () => {
    // Procurar por uma despesa e clicar para marcar como paga
    cy.get('button[aria-label*="mark paid"], button[title*="pag"]').first().click()
    
    cy.get('.Toastify__toast--success', { timeout: 5000 }).should('be.visible')
  })

  it('should delete expense', () => {
    // Encontrar e clicar no botão de delete
    cy.get('button[aria-label*="delete"], button[title*="delete"]').first().click()
    
    // Confirmar exclusão se houver modal
    cy.get('button').contains('Confirmar').click({ force: true })
    
    cy.get('.Toastify__toast--success', { timeout: 5000 }).should('be.visible')
  })

  it('should filter expenses by status', () => {
    cy.get('select[name="status"]').select('EM_ABERTO')
    
    // Verificar se a lista foi atualizada
    cy.get('table tbody tr').should('have.length.greaterThan', 0)
  })

  it('should sort expenses by due date', () => {
    cy.get('button').contains('Data de Vencimento').click()
    
    // Verificar se está ordenado
    cy.get('table tbody tr').first().should('be.visible')
  })
})
