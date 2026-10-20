from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId

from utils.security import get_password_hash


class TestAuthenticationFull:
    """Testes completos de autenticação e token"""

    def test_login_success(self, client, mocker):
        """Testa login bem-sucedido"""
        user_data = {
            "_id": ObjectId(),
            "email": "test@example.com",
            "hashed_password": get_password_hash("password123"),
            "is_active": True,
            "full_name": "Test User",
        }

        mocker.patch("routers.auth.create_access_token", return_value="fake_token")
        mock_db = mocker.AsyncMock()
        mock_db.users.find_one = AsyncMock(return_value=user_data)
        mocker.patch("routers.auth.get_database", return_value=mock_db)

        response = client.post(
            "/api/auth/login",
            data={"username": "test@example.com", "password": "password123"},
        )
        assert response.status_code == 200
        assert "access_token" in response.json()
        assert response.json()["token_type"] == "bearer"

    def test_login_inactive_user(self, client, mocker):
        """Testa login com usuário inativo"""
        user_data = {
            "_id": ObjectId(),
            "email": "inactive@example.com",
            "hashed_password": get_password_hash("password123"),
            "is_active": False,
        }

        mock_db = mocker.AsyncMock()
        mock_db.users.find_one = AsyncMock(return_value=user_data)
        mocker.patch("routers.auth.get_database", return_value=mock_db)

        response = client.post(
            "/api/auth/login",
            data={"username": "inactive@example.com", "password": "password123"},
        )
        assert response.status_code == 400

    def test_login_wrong_password(self, client, mocker):
        """Testa login com senha incorreta"""
        user_data = {
            "_id": ObjectId(),
            "email": "test@example.com",
            "hashed_password": get_password_hash("correctpassword123"),
            "is_active": True,
        }

        mock_db = mocker.AsyncMock()
        mock_db.users.find_one = AsyncMock(return_value=user_data)
        mocker.patch("routers.auth.get_database", return_value=mock_db)

        response = client.post(
            "/api/auth/login",
            data={"username": "test@example.com", "password": "wrongpass"},
        )
        assert response.status_code == 401
        assert "Email ou senha incorretos" in response.text


class TestUtilValidation:
    """Testes para validações de utilitários"""

    def test_cpf_validation_valid(self):
        """Testa validação de CPF válido"""
        from utils.cpf_validator import validate_cpf

        # CPF válido (11.144.477-35)
        assert validate_cpf("11144477735")

    def test_cpf_validation_invalid(self):
        """Testa validação de CPF inválido"""
        from utils.cpf_validator import validate_cpf

        assert not validate_cpf("00000000000")
        assert not validate_cpf("12345678901")

    def test_cpf_clean_format(self):
        """Testa limpeza de formato CPF"""
        from utils.cpf_validator import clean_cpf

        assert clean_cpf("111.444.777-35") == "11144477735"
        assert clean_cpf("11144477735") == "11144477735"

    def test_currency_formatting(self):
        """Testa formatação de moeda brasileira"""
        from utils.formatting import format_currency_br

        assert format_currency_br(1234.56) == "1.234,56"
        assert format_currency_br(0) == "0,00"

    def test_cpf_formatting(self):
        """Testa formatação de CPF"""
        from utils.formatting import format_cpf

        assert format_cpf("11144477735") == "111.444.777-35"

    def test_phone_formatting(self):
        """Testa formatação de telefone"""
        from utils.formatting import format_phone

        assert format_phone("11999999999") == "(11) 99999-9999"


class TestExpenseModels:
    """Testes de validação dos modelos de despesa"""

    def test_expense_base_validation(self):
        """Testa validação de dados básicos de despesa"""
        from models.expense import ExpenseBase, ExpenseStatus, PaymentSource

        expense = ExpenseBase(
            description="Test Expense",
            amount=100.50,
            due_date=datetime.now(UTC),
            status=ExpenseStatus.PAGO,
            category="Food",
            payment_source=PaymentSource.CREDIT_CARD,
        )
        assert expense.amount == 100.50
        assert expense.description == "Test Expense"

    def test_expense_amount_validation(self):
        """Testa validação de valor mínimo de despesa"""
        from pydantic import ValidationError

        from models.expense import ExpenseBase, ExpenseStatus

        with pytest.raises(ValidationError):
            ExpenseBase(
                description="Test",
                amount=-50,  # Valor negativo deve falhar
                due_date=datetime.now(UTC),
                status=ExpenseStatus.PAGO,
            )

    def test_expense_update_model(self):
        """Testa modelo de atualização de despesa"""
        from models.expense import ExpenseUpdate

        update = ExpenseUpdate(description="Updated", amount=200.00)
        assert update.description == "Updated"
        assert update.amount == 200.00


class TestIncomeModels:
    """Testes de validação dos modelos de receita"""

    def test_income_base_validation(self):
        """Testa validação de dados básicos de receita"""
        from models.income import IncomeBase, IncomeType

        income = IncomeBase(
            description="Salary",
            amount=5000.00,
            income_type=IncomeType.FIXED,
            payment_day=5,
        )
        assert income.amount == 5000.00
        assert income.income_type == IncomeType.FIXED

    def test_income_variable_type(self):
        """Testa receita variável com data"""
        from models.income import IncomeBase, IncomeType

        income = IncomeBase(
            description="Freelance",
            amount=1000.00,
            income_type=IncomeType.VARIABLE,
            payment_date=datetime.now(UTC),
        )
        assert income.income_type == IncomeType.VARIABLE

    def test_income_amount_validation(self):
        """Testa validação de valor mínimo de receita"""
        from pydantic import ValidationError

        from models.income import IncomeBase, IncomeType

        with pytest.raises(ValidationError):
            IncomeBase(
                description="Test",
                amount=0,  # Valor zero deve falhar
                income_type=IncomeType.FIXED,
            )


class TestDebtModels:
    """Testes de validação dos modelos de dívida"""

    def test_debt_base_validation(self):
        """Testa validação de dados básicos de dívida"""
        from models.debt import DebtBase, DebtStatus, DebtType

        debt = DebtBase(
            name="Credit Card Debt",
            debt_type=DebtType.CREDIT_CARD,
            total_amount=5000.00,
            current_balance=2500.00,
            interest_rate=3.5,
            due_day=10,
            status=DebtStatus.ACTIVE,
        )
        assert debt.total_amount == 5000.00
        assert debt.current_balance == 2500.00

    def test_debt_balance_validation(self):
        """Testa validação de saldo (não pode ser maior que total)"""
        from pydantic import ValidationError

        from models.debt import DebtBase, DebtType

        with pytest.raises(ValidationError):
            DebtBase(
                name="Test",
                debt_type=DebtType.LOAN,
                total_amount=1000.00,
                current_balance=2000.00,  # Maior que total
                interest_rate=5.0,
                due_day=10,
            )

    def test_debt_interest_rate_range(self):
        """Testa validação de taxa de juros"""
        from pydantic import ValidationError

        from models.debt import DebtBase, DebtType

        with pytest.raises(ValidationError):
            DebtBase(
                name="Test",
                debt_type=DebtType.LOAN,
                total_amount=1000.00,
                current_balance=500.00,
                interest_rate=150.0,  # Acima de 100%
                due_day=10,
            )


class TestUserModels:
    """Testes de validação dos modelos de usuário"""

    def test_user_create_validation(self):
        """Testa criação de usuário com validação de CPF"""
        from models.user import UserCreate, UserRole

        user = UserCreate(
            email="test@example.com",
            full_name="Test User",
            password="securepassword123",
            cpf="11144477735",  # CPF válido
            role=UserRole.USER,
        )
        assert user.email == "test@example.com"
        assert user.cpf == "11144477735"

    def test_user_email_validation(self):
        """Testa validação de email"""
        from pydantic import ValidationError

        from models.user import UserCreate

        with pytest.raises(ValidationError):
            UserCreate(
                email="invalid-email",  # Email inválido
                full_name="Test",
                password="password123",
            )

    def test_user_password_validation(self):
        """Testa validação de senha mínima"""
        from pydantic import ValidationError

        from models.user import UserCreate

        with pytest.raises(ValidationError):
            UserCreate(
                email="test@example.com",
                full_name="Test",
                password="123",  # Senha muito curta
            )


class TestFamilyModels:
    """Testes de validação dos modelos de família"""

    def test_family_creation(self):
        """Testa criação de família"""
        from models.family import FamilyCreate

        family = FamilyCreate(
            name="Silva Family", description="Family of Silva", owner_cpf="11144477735"
        )
        assert family.name == "Silva Family"

    def test_family_name_validation(self):
        """Testa validação de nome mínimo de família"""
        from pydantic import ValidationError

        from models.family import FamilyCreate

        with pytest.raises(ValidationError):
            FamilyCreate(
                name="A",  # Muito curto
                owner_cpf="11144477735",
            )


class TestFinancialModels:
    """Testes de modelos financeiros"""

    def test_monthly_total_creation(self):
        """Testa criação de resumo mensal"""
        from models.monthly_summary import MonthlyTotal, OwnerTotal

        owner = OwnerTotal(owner="user123", full_name="John Doe")
        monthly = MonthlyTotal(
            month=1, year=2026, total_paid=1000.00, total_pending=500.00, owners=[owner]
        )
        assert monthly.month == 1
        assert monthly.year == 2026
        assert len(monthly.owners) == 1

    def test_monthly_total_month_validation(self):
        """Testa validação de mês (1-12)"""
        from pydantic import ValidationError

        from models.monthly_summary import MonthlyTotal

        with pytest.raises(ValidationError):
            MonthlyTotal(month=13, year=2026)  # Mês inválido

        with pytest.raises(ValidationError):
            MonthlyTotal(month=0, year=2026)  # Mês inválido


class TestSecurityUtils:
    """Testes de utilitários de segurança"""

    def test_password_hashing(self):
        """Testa hashing de senha"""
        from utils.security import get_password_hash, verify_password

        password = "mypassword123"
        hashed = get_password_hash(password)

        assert hashed != password
        assert verify_password(password, hashed)
        assert not verify_password("wrongpassword", hashed)

    def test_password_different_hashes(self):
        """Testa que mesma senha gera hashes diferentes"""
        from utils.security import get_password_hash

        password = "mypassword123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        assert hash1 != hash2  # Deve ser diferente por causa do salt


class TestDatabaseConnection:
    """Testes de conexão com banco de dados"""

    def test_database_initialization(self):
        """Testa inicialização do banco de dados"""
        # Testa se função existe e é async
        import inspect

        from database import get_database

        assert inspect.iscoroutinefunction(get_database)
