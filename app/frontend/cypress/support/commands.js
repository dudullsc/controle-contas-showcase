// https://on.cypress.io/custom-commands
// Cypress.Commands.add('login', (email, password) => { ... })
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login')
  cy.get('input[type="email"]').type(email)
  cy.get('input[type="password"]').type(password)
  cy.get('button[type="submit"]').click()
  cy.url().should('include', '/dashboard')
})

Cypress.Commands.add('fillExpenseForm', (expense) => {
  if (expense.description) {
    cy.get('input[placeholder*="Descrição"]').type(expense.description)
  }
  if (expense.amount) {
    cy.get('input[placeholder*="Valor"]').type(expense.amount.toString())
  }
  if (expense.category) {
    cy.get('select[name="category"]').select(expense.category)
  }
  if (expense.dueDate) {
    cy.get('input[type="date"]').type(expense.dueDate)
  }
})
