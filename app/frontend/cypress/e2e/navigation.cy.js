describe('Dashboard Navigation', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.get('input[type="email"]').type('admin@example.com')
    cy.get('input[type="password"]').type('admin123')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard')
  })

  it('should navigate to all dashboard sections', () => {
    // Dashboard home
    cy.visit('/dashboard')
    cy.url().should('include', '/dashboard')

    // Expenses
    cy.visit('/dashboard/expenses')
    cy.url().should('include', '/dashboard/expenses')

    // Incomes
    cy.visit('/dashboard/incomes')
    cy.url().should('include', '/dashboard/incomes')

    // Users (admin only)
    cy.visit('/dashboard/users')
    cy.url().should('include', '/dashboard/users')

    // Profile
    cy.visit('/dashboard/profile')
    cy.url().should('include', '/dashboard/profile')

    // Settings
    cy.visit('/dashboard/settings')
    cy.url().should('include', '/dashboard/settings')
  })

  it('should redirect to login if not authenticated', () => {
    // Limpar tokens
    cy.window().then((window) => {
      window.localStorage.clear()
      window.sessionStorage.clear()
    })

    cy.visit('/dashboard/expenses')
    cy.url().should('include', '/login')
  })

  it('should show sidebar navigation on desktop', () => {
    cy.viewport('macbook-15')
    cy.visit('/dashboard')
    cy.get('nav[aria-label="Navegação desktop"]').should('be.visible')
    cy.contains('Despesas').should('be.visible')
    cy.contains('Receitas').should('be.visible')
  })

  it('should show bottom navigation on mobile', () => {
    cy.viewport('iphone-x')
    cy.visit('/dashboard')

    cy.get('[data-testid="mobile-bottom-nav"]').should('be.visible')
    cy.get('[aria-label="Despesas"]').should('be.visible')
    cy.get('[aria-label="Mais opções"]').click()
    cy.get('[data-testid="mobile-more-sheet"]').should('be.visible')
    cy.contains('Meu Perfil').should('be.visible')
  })
})

describe('Responsive Design', () => {
  beforeEach(() => {
    cy.visit('/login')
  })

  it('should be responsive on mobile', () => {
    cy.viewport('iphone-x')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
  })

  it('should be responsive on tablet', () => {
    cy.viewport('ipad-2')
    cy.get('input[type="email"]').should('be.visible')
  })

  it('should be responsive on desktop', () => {
    cy.viewport('macbook-15')
    cy.get('input[type="email"]').should('be.visible')
  })
})
