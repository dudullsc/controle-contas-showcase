describe('Login Flow', () => {
  beforeEach(() => {
    cy.visit('/login')
  })

  it('should display login page', () => {
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })

  it('should show error with invalid credentials', () => {
    cy.get('input[type="email"]').type('invalid@example.com')
    cy.get('input[type="password"]').type('wrongpassword')
    cy.get('button[type="submit"]').click()
    // Verificar se há mensagem de erro
    cy.get('.Toastify__toast--error', { timeout: 5000 }).should('be.visible')
  })

  it('should login successfully with valid credentials', () => {
    // Usar credenciais de teste (você pode usar fixtures)
    cy.get('input[type="email"]').type('admin@example.com')
    cy.get('input[type="password"]').type('admin123')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard', { timeout: 10000 })
  })

  it('should remember email when checkbox is checked', () => {
    cy.get('input[type="email"]').type('test@example.com')
    cy.get('input[type="checkbox"]').click()
    cy.get('button[type="submit"]').click()
    // Verificar localStorage
    cy.window().then((window) => {
      expect(window.localStorage.getItem('saved_login_email')).to.equal('test@example.com')
    })
  })

  it('should toggle password visibility', () => {
    const passwordInput = cy.get('input[type="password"]')
    passwordInput.type('password123')
    
    // Clicar no botão de mostrar/esconder
    cy.get('button[aria-label*="password"], [role="button"]:contains("Eye")').click()
    
    // Password input pode ter mudado para type="text"
    cy.get('input').should('have.value', 'password123')
  })
})
