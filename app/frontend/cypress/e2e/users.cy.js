describe('User Management Flow', () => {
  beforeEach(() => {
    // Login como admin
    cy.visit('/login')
    cy.get('input[type="email"]').type('admin@example.com')
    cy.get('input[type="password"]').type('admin123')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/dashboard')
    
    // Navegar para usuários
    cy.visit('/dashboard/users')
  })

  it('should display users page', () => {
    cy.contains('Usuários').should('be.visible')
    cy.get('button').contains('Novo Usuário').should('be.visible')
  })

  it('should open create user modal', () => {
    cy.get('button').contains('Novo Usuário').click()
    cy.get('h3').contains('Novo Usuário').should('be.visible')
  })

  it('should validate required fields on user creation', () => {
    cy.get('button').contains('Novo Usuário').click()
    cy.get('button[type="submit"]').click()
    
    // Verificar mensagens de erro
    cy.contains('Nome é obrigatório').should('be.visible')
    cy.contains('Email é obrigatório').should('be.visible')
  })

  it('should validate CPF format', () => {
    cy.get('button').contains('Novo Usuário').click()
    
    const cpfInput = cy.get('input[placeholder*="CPF"]')
    cpfInput.type('12345')
    
    // Verificar se há erro de validação
    cy.contains('CPF inválido').should('be.visible')
  })

  it('should validate email format', () => {
    cy.get('button').contains('Novo Usuário').click()
    
    cy.get('input[placeholder*="Email"]').type('invalid-email')
    cy.get('button[type="submit"]').click()
    
    cy.contains('Email inválido').should('be.visible')
  })

  it('should validate password strength', () => {
    cy.get('button').contains('Novo Usuário').click()
    
    // Preencher formulário com senhas fracas
    cy.get('input[type="password"]').first().type('123')
    
    // Verificar indicador de força de senha fraca
    cy.contains('Senha fraca').should('be.visible')
  })

  it('should check password confirmation match', () => {
    cy.get('button').contains('Novo Usuário').click()
    
    cy.get('input[type="password"]').first().type('SecurePass123!')
    cy.get('input[placeholder*="Confirmar"]').type('DifferentPass')
    
    cy.contains('As senhas não conferem').should('be.visible')
  })

  it('should create user successfully', () => {
    cy.get('button').contains('Novo Usuário').click()
    
    cy.get('input[placeholder*="Nome"]').type('Novo Usuário Teste')
    cy.get('input[placeholder*="Email"]').type('newuser@example.com')
    cy.get('input[placeholder*="CPF"]').type('11144477735')
    cy.get('input[type="password"]').first().type('SecurePass123!')
    cy.get('input[placeholder*="Confirmar"]').type('SecurePass123!')
    cy.get('input[placeholder*="Telefone"]').type('(48) 9 8859-3816')
    
    cy.get('button[type="submit"]').click()
    
    cy.get('.Toastify__toast--success', { timeout: 5000 }).should('be.visible')
    cy.contains('Usuário criado com sucesso').should('be.visible')
  })

  it('should edit existing user', () => {
    // Encontrar usuário e clicar edit
    cy.get('button[aria-label*="edit"]').first().click()
    
    cy.get('h3').contains('Editar Usuário').should('be.visible')
    
    cy.get('input[placeholder*="Nome"]').clear().type('Usuário Atualizado')
    cy.get('button[type="submit"]').click()
    
    cy.get('.Toastify__toast--success', { timeout: 5000 }).should('be.visible')
  })

  it('should delete user with confirmation', () => {
    cy.get('button[aria-label*="delete"]').first().click()
    
    // Confirmar exclusão
    cy.get('button').contains('Confirmar').click()
    
    cy.get('.Toastify__toast--success', { timeout: 5000 }).should('be.visible')
  })

  it('should toggle user active status', () => {
    cy.get('input[type="checkbox"][name*="active"]').first().click({ force: true })
    
    cy.get('button[type="submit"]').click()
    
    cy.get('.Toastify__toast--success', { timeout: 5000 }).should('be.visible')
  })
})
