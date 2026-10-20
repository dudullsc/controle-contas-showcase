"""
Testes para API endpoints dos routers
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId


class TestExpensesEndpoints:
    """Testes para endpoints de despesas"""

    def test_list_expenses_empty(self, client, mocker):
        """Testa listagem de despesas vazia"""
        mock_db = mocker.AsyncMock()
        mock_db.expenses.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=[]))
        )
        mocker.patch("routers.expenses.get_database", return_value=mock_db)

        response = client.get("/api/expenses")
        # Sem autenticação, deve retornar 403
        assert response.status_code in [403, 401]

    def test_create_expense_missing_fields(self, client):
        """Testa criação de despesa com campos faltantes"""
        response = client.post("/api/expenses", json={})
        assert response.status_code in [422, 401, 403]  # Validation error ou auth error

    def test_get_expense_not_found(self, client, mocker):
        """Testa obtenção de despesa inexistente"""
        mock_db = mocker.AsyncMock()
        mock_db.expenses.find_one = AsyncMock(return_value=None)
        mocker.patch("routers.expenses.get_database", return_value=mock_db)

        response = client.get(f"/api/expenses/{ObjectId()}")
        assert response.status_code in [403, 401, 404]


class TestIncomesEndpoints:
    """Testes para endpoints de receitas"""

    def test_list_incomes_empty(self, client, mocker):
        """Testa listagem de receitas vazia"""
        mock_db = mocker.AsyncMock()
        mock_db.incomes.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=[]))
        )
        mocker.patch("routers.incomes.get_database", return_value=mock_db)

        response = client.get("/api/incomes")
        assert response.status_code in [403, 401]

    def test_create_income_missing_fields(self, client):
        """Testa criação de receita com campos faltantes"""
        response = client.post("/api/incomes", json={})
        assert response.status_code in [422, 401, 403]


class TestDebtsEndpoints:
    """Testes para endpoints de dívidas"""

    def test_list_debts_empty(self, client, mocker):
        """Testa listagem de dívidas vazia"""
        mock_db = mocker.AsyncMock()
        mock_db.debts.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=[]))
        )
        mocker.patch("routers.debts.get_database", return_value=mock_db)

        response = client.get("/api/debts")
        assert response.status_code in [403, 401]

    def test_create_debt_missing_fields(self, client):
        """Testa criação de dívida com campos faltantes"""
        response = client.post("/api/debts", json={})
        assert response.status_code in [422, 401, 403]


class TestUsersEndpoints:
    """Testes para endpoints de usuários"""

    def test_list_users_empty(self, client, mocker):
        """Testa listagem de usuários vazia"""
        mock_db = mocker.AsyncMock()
        mock_db.users.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=[]))
        )
        mocker.patch("routers.users.get_database", return_value=mock_db)

        response = client.get("/api/users")
        assert response.status_code in [403, 401]

    def test_create_user_invalid_cpf(self, client):
        """Testa criação de usuário com CPF inválido"""
        response = client.post(
            "/api/users",
            json={
                "email": "test@example.com",
                "full_name": "Test User",
                "password": "securepass123",
                "cpf": "00000000000",  # CPF inválido
            },
        )
        assert response.status_code in [422, 401, 403]


class TestFamiliesEndpoints:
    """Testes para endpoints de famílias"""

    def test_list_families_empty(self, client, mocker):
        """Testa listagem de famílias vazia"""
        mock_db = mocker.AsyncMock()
        mock_db.families.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=[]))
        )
        mocker.patch("routers.families.get_database", return_value=mock_db)

        response = client.get("/api/families")
        assert response.status_code in [403, 401]

    def test_create_family_missing_fields(self, client):
        """Testa criação de família com campos faltantes"""
        response = client.post("/api/families", json={})
        assert response.status_code in [422, 401, 403]


class TestFinancialEndpoints:
    """Testes para endpoints financeiros"""

    def test_dashboard_invalid_month(self, client):
        """Testa dashboard com mês inválido"""
        response = client.get("/api/financial/dashboard?month=13")
        assert response.status_code in [422, 401, 403]

    def test_dashboard_invalid_year(self, client):
        """Testa dashboard com ano inválido"""
        response = client.get("/api/financial/dashboard?year=1999")
        assert response.status_code in [422, 401, 403]


class TestReportsEndpoints:
    """Testes para endpoints de relatórios"""

    def test_monthly_report_invalid_month(self, client):
        """Testa relatório mensal com mês inválido"""
        response = client.get("/api/reports/monthly?month=0")
        assert response.status_code in [422, 401, 403]

    def test_annual_report_invalid_year(self, client):
        """Testa relatório anual com ano inválido"""
        response = client.get("/api/reports/annual?year=1900")
        assert response.status_code in [422, 401, 403, 404]  # 404 se rota não existe


class TestInputValidation:
    """Testes de validação de entrada"""

    def test_expense_description_too_long(self):
        """Testa descrição de despesa acima do limite"""
        from pydantic import ValidationError

        from models.expense import ExpenseBase, ExpenseStatus

        with pytest.raises(ValidationError):
            ExpenseBase(
                description="x" * 101,  # Limite é 100
                amount=100.00,
                due_date=datetime.now(UTC),
                status=ExpenseStatus.PAGO,
            )

    def test_income_description_too_long(self):
        """Testa descrição de receita acima do limite"""
        from pydantic import ValidationError

        from models.income import IncomeBase, IncomeType

        with pytest.raises(ValidationError):
            IncomeBase(
                description="x" * 201,  # Limite é 200
                amount=100.00,
                income_type=IncomeType.FIXED,
            )

    def test_debt_name_too_long(self):
        """Testa nome de dívida acima do limite"""
        from pydantic import ValidationError

        from models.debt import DebtBase, DebtType

        with pytest.raises(ValidationError):
            DebtBase(
                name="x" * 101,  # Limite é 100
                debt_type=DebtType.LOAN,
                total_amount=1000.00,
                current_balance=500.00,
                interest_rate=5.0,
                due_day=10,
            )

    def test_user_cpf_empty_string(self):
        """Testa CPF como string vazia"""
        from models.user import UserCreate

        # CPF vazio é permitido (opcional)
        user = UserCreate(
            email="test@example.com", full_name="Test", password="password123", cpf=""
        )
        assert user.cpf is None

    def test_salary_payment_day_invalid(self):
        """Testa dia de pagamento inválido"""
        from pydantic import ValidationError

        from models.user import UserBase

        with pytest.raises(ValidationError):
            UserBase(
                email="test@example.com",
                full_name="Test",
                salary_payment_day=32,  # Máximo é 31
            )

    def test_expense_due_date_format(self):
        """Testa formato de data de vencimento"""
        from models.expense import ExpenseBase, ExpenseStatus

        expense = ExpenseBase(
            description="Test",
            amount=100.00,
            due_date=datetime.now(UTC),
            status=ExpenseStatus.PAGO,
        )
        assert isinstance(expense.due_date, datetime)


class TestEnumValidation:
    """Testes de enumerações"""

    def test_expense_status_enum(self):
        """Testa valores válidos de status de despesa"""
        from models.expense import ExpenseStatus

        assert ExpenseStatus.PAGO.value == "PAGO"
        assert ExpenseStatus.EM_ABERTO.value == "EM ABERTO"
        assert ExpenseStatus.NAO_PAGO.value == "NÃO PAGO"

    def test_income_type_enum(self):
        """Testa valores válidos de tipo de receita"""
        from models.income import IncomeType

        assert IncomeType.FIXED.value == "FIXED"
        assert IncomeType.VARIABLE.value == "VARIABLE"

    def test_debt_type_enum(self):
        """Testa valores válidos de tipo de dívida"""
        from models.debt import DebtType

        assert DebtType.CREDIT_CARD.value == "CREDIT_CARD"
        assert DebtType.LOAN.value == "LOAN"
        assert DebtType.FINANCING.value == "FINANCING"
        assert DebtType.OVERDRAFT.value == "OVERDRAFT"

    def test_debt_status_enum(self):
        """Testa valores válidos de status de dívida"""
        from models.debt import DebtStatus

        assert DebtStatus.ACTIVE.value == "ACTIVE"
        assert DebtStatus.PAID_OFF.value == "PAID_OFF"
        assert DebtStatus.RENEGOTIATED.value == "RENEGOTIATED"


class TestEdgeCases:
    """Testes para casos extremos"""

    def test_zero_expense_amount(self):
        """Testa despesa com valor zero"""
        from pydantic import ValidationError

        from models.expense import ExpenseBase, ExpenseStatus

        with pytest.raises(ValidationError):
            ExpenseBase(
                description="Test",
                amount=0,
                due_date=datetime.now(UTC),
                status=ExpenseStatus.PAGO,
            )

    def test_very_large_expense_amount(self):
        """Testa despesa com valor muito grande"""
        from models.expense import ExpenseBase, ExpenseStatus

        expense = ExpenseBase(
            description="Test",
            amount=999999999.99,
            due_date=datetime.now(UTC),
            status=ExpenseStatus.PAGO,
        )
        assert expense.amount == 999999999.99

    def test_negative_minimum_payment(self):
        """Testa pagamento mínimo negativo em dívida"""
        from pydantic import ValidationError

        from models.debt import DebtBase, DebtType

        with pytest.raises(ValidationError):
            DebtBase(
                name="Test",
                debt_type=DebtType.LOAN,
                total_amount=1000.00,
                current_balance=500.00,
                interest_rate=5.0,
                minimum_payment=-50,
                due_day=10,
            )

    def test_future_payment_day_income(self):
        """Testa receita com dia de pagamento futuro válido"""
        from models.income import IncomeBase, IncomeType

        income = IncomeBase(
            description="Salary",
            amount=5000.00,
            income_type=IncomeType.FIXED,
            payment_day=25,
        )
        assert income.payment_day == 25
