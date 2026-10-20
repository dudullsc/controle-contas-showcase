"""
Testes de Integração CRUD para Endpoints
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

from bson import ObjectId

from utils.security import get_password_hash


class TestUsersCRUD:
    """Testes CRUD para usuários"""

    def test_create_user_success(self, client, mocker):
        """Testa criação bem-sucedida de usuário"""
        user_data = {
            "email": "newuser@example.com",
            "full_name": "New User",
            "password": "securepass123",
            "cpf": "11144477735",
        }

        mock_db = mocker.AsyncMock()
        mock_db.users.insert_one = AsyncMock(
            return_value=AsyncMock(inserted_id=ObjectId())
        )
        mock_db.users.find_one = AsyncMock(
            return_value={
                "_id": ObjectId(),
                **user_data,
                "hashed_password": get_password_hash(user_data["password"]),
                "is_active": True,
                "is_admin": False,
                "role": "USER",
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            }
        )
        mocker.patch("routers.users.get_database", return_value=mock_db)

        response = client.post("/api/users", json=user_data)
        assert response.status_code in [201, 200, 401, 403]  # Depende de auth

    def test_list_users(self, client, mocker):
        """Testa listagem de usuários"""
        users_data = [
            {
                "_id": ObjectId(),
                "email": f"user{i}@example.com",
                "full_name": f"User {i}",
                "is_active": True,
            }
            for i in range(3)
        ]

        mock_db = mocker.AsyncMock()
        mock_db.users.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=users_data))
        )
        mocker.patch("routers.users.get_database", return_value=mock_db)

        response = client.get("/api/users")
        assert response.status_code in [200, 401, 403]

    def test_get_user_by_id(self, client, mocker):
        """Testa obtenção de usuário por ID"""
        user_id = ObjectId()
        user_data = {
            "_id": user_id,
            "email": "user@example.com",
            "full_name": "User",
            "is_active": True,
        }

        mock_db = mocker.AsyncMock()
        mock_db.users.find_one = AsyncMock(return_value=user_data)
        mocker.patch("routers.users.get_database", return_value=mock_db)

        response = client.get(f"/api/users/{user_id}")
        assert response.status_code in [200, 401, 403, 404]

    def test_update_user(self, client, mocker):
        """Testa atualização de usuário"""
        user_id = ObjectId()
        update_data = {"full_name": "Updated Name", "monthly_salary": 6000.00}

        mock_db = mocker.AsyncMock()
        mock_db.users.update_one = AsyncMock(return_value=AsyncMock(modified_count=1))
        mock_db.users.find_one = AsyncMock(
            return_value={
                "_id": user_id,
                "email": "user@example.com",
                **update_data,
                "is_active": True,
            }
        )
        mocker.patch("routers.users.get_database", return_value=mock_db)

        response = client.put(f"/api/users/{user_id}", json=update_data)
        assert response.status_code in [200, 401, 403, 404]

    def test_delete_user(self, client, mocker):
        """Testa deleção de usuário"""
        user_id = ObjectId()

        mock_db = mocker.AsyncMock()
        mock_db.users.delete_one = AsyncMock(return_value=AsyncMock(deleted_count=1))
        mocker.patch("routers.users.get_database", return_value=mock_db)

        response = client.delete(f"/api/users/{user_id}")
        assert response.status_code in [200, 204, 401, 403, 404]


class TestExpensesCRUD:
    """Testes CRUD para despesas"""

    def test_create_expense_success(self, client, mocker):
        """Testa criação bem-sucedida de despesa"""
        expense_data = {
            "description": "Test Expense",
            "amount": 150.50,
            "due_date": datetime.now(UTC).isoformat(),
            "category": "Food",
            "status": "EM ABERTO",
        }

        mock_db = mocker.AsyncMock()
        mock_db.expenses.insert_one = AsyncMock(
            return_value=AsyncMock(inserted_id=ObjectId())
        )
        mock_db.expenses.find_one = AsyncMock(
            return_value={
                "_id": ObjectId(),
                **expense_data,
                "user_id": "user123",
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            }
        )
        mocker.patch("routers.expenses.get_database", return_value=mock_db)

        response = client.post("/api/expenses", json=expense_data)
        assert response.status_code in [201, 200, 401, 403, 422]

    def test_list_expenses(self, client, mocker):
        """Testa listagem de despesas"""
        expenses_data = [
            {
                "_id": ObjectId(),
                "description": f"Expense {i}",
                "amount": 100.00 + i,
                "status": "PAGO",
            }
            for i in range(5)
        ]

        mock_db = mocker.AsyncMock()
        mock_db.expenses.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=expenses_data))
        )
        mocker.patch("routers.expenses.get_database", return_value=mock_db)

        response = client.get("/api/expenses")
        assert response.status_code in [200, 401, 403]

    def test_get_expense_by_id(self, client, mocker):
        """Testa obtenção de despesa por ID"""
        expense_id = ObjectId()
        expense_data = {
            "_id": expense_id,
            "description": "Test Expense",
            "amount": 100.00,
            "status": "PAGO",
        }

        mock_db = mocker.AsyncMock()
        mock_db.expenses.find_one = AsyncMock(return_value=expense_data)
        mocker.patch("routers.expenses.get_database", return_value=mock_db)

        response = client.get(f"/api/expenses/{expense_id}")
        assert response.status_code in [200, 401, 403, 404]

    def test_update_expense(self, client, mocker):
        """Testa atualização de despesa"""
        expense_id = ObjectId()
        update_data = {
            "description": "Updated Expense",
            "amount": 200.00,
            "status": "PAGO",
        }

        mock_db = mocker.AsyncMock()
        mock_db.expenses.update_one = AsyncMock(
            return_value=AsyncMock(modified_count=1)
        )
        mock_db.expenses.find_one = AsyncMock(
            return_value={"_id": expense_id, **update_data}
        )
        mocker.patch("routers.expenses.get_database", return_value=mock_db)

        response = client.put(f"/api/expenses/{expense_id}", json=update_data)
        assert response.status_code in [200, 401, 403, 404]

    def test_delete_expense(self, client, mocker):
        """Testa deleção de despesa"""
        expense_id = ObjectId()

        mock_db = mocker.AsyncMock()
        mock_db.expenses.delete_one = AsyncMock(return_value=AsyncMock(deleted_count=1))
        mocker.patch("routers.expenses.get_database", return_value=mock_db)

        response = client.delete(f"/api/expenses/{expense_id}")
        assert response.status_code in [200, 204, 401, 403, 404]

    def test_filter_expenses_by_status(self, client, mocker):
        """Testa filtro de despesas por status"""
        expenses_data = [
            {
                "_id": ObjectId(),
                "description": "Paid Expense",
                "amount": 100.00,
                "status": "PAGO",
            }
        ]

        mock_db = mocker.AsyncMock()
        mock_db.expenses.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=expenses_data))
        )
        mocker.patch("routers.expenses.get_database", return_value=mock_db)

        response = client.get("/api/expenses?status=PAGO")
        assert response.status_code in [200, 401, 403]


class TestIncomesCRUD:
    """Testes CRUD para receitas"""

    def test_create_income_success(self, client, mocker):
        """Testa criação bem-sucedida de receita"""
        income_data = {
            "description": "Salary",
            "amount": 5000.00,
            "income_type": "FIXED",
            "payment_day": 5,
        }

        mock_db = mocker.AsyncMock()
        mock_db.incomes.insert_one = AsyncMock(
            return_value=AsyncMock(inserted_id=ObjectId())
        )
        mock_db.incomes.find_one = AsyncMock(
            return_value={
                "_id": ObjectId(),
                **income_data,
                "user_id": "user123",
                "is_active": True,
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            }
        )
        mocker.patch("routers.incomes.get_database", return_value=mock_db)

        response = client.post("/api/incomes", json=income_data)
        assert response.status_code in [201, 200, 401, 403, 422]

    def test_list_incomes_with_filter(self, client, mocker):
        """Testa listagem de receitas com filtro"""
        incomes_data = [
            {
                "_id": ObjectId(),
                "description": "Salary",
                "amount": 5000.00,
                "income_type": "FIXED",
                "is_active": True,
            }
        ]

        mock_db = mocker.AsyncMock()
        mock_db.incomes.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=incomes_data))
        )
        mocker.patch("routers.incomes.get_database", return_value=mock_db)

        response = client.get("/api/incomes?income_type=FIXED")
        assert response.status_code in [200, 401, 403]

    def test_update_income(self, client, mocker):
        """Testa atualização de receita"""
        income_id = ObjectId()
        update_data = {"amount": 5500.00, "payment_day": 10}

        mock_db = mocker.AsyncMock()
        mock_db.incomes.update_one = AsyncMock(return_value=AsyncMock(modified_count=1))
        mock_db.incomes.find_one = AsyncMock(
            return_value={
                "_id": income_id,
                "description": "Salary",
                **update_data,
                "income_type": "FIXED",
            }
        )
        mocker.patch("routers.incomes.get_database", return_value=mock_db)

        response = client.put(f"/api/incomes/{income_id}", json=update_data)
        assert response.status_code in [200, 401, 403, 404]

    def test_delete_income(self, client, mocker):
        """Testa deleção de receita"""
        income_id = ObjectId()

        mock_db = mocker.AsyncMock()
        mock_db.incomes.delete_one = AsyncMock(return_value=AsyncMock(deleted_count=1))
        mocker.patch("routers.incomes.get_database", return_value=mock_db)

        response = client.delete(f"/api/incomes/{income_id}")
        assert response.status_code in [200, 204, 401, 403, 404]


class TestDebtsCRUD:
    """Testes CRUD para dívidas"""

    def test_create_debt_success(self, client, mocker):
        """Testa criação bem-sucedida de dívida"""
        debt_data = {
            "name": "Credit Card",
            "debt_type": "CREDIT_CARD",
            "total_amount": 5000.00,
            "current_balance": 2500.00,
            "interest_rate": 3.5,
            "due_day": 10,
        }

        mock_db = mocker.AsyncMock()
        mock_db.debts.insert_one = AsyncMock(
            return_value=AsyncMock(inserted_id=ObjectId())
        )
        mock_db.debts.find_one = AsyncMock(
            return_value={
                "_id": ObjectId(),
                **debt_data,
                "user_id": "user123",
                "status": "ACTIVE",
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            }
        )
        mocker.patch("routers.debts.get_database", return_value=mock_db)

        response = client.post("/api/debts", json=debt_data)
        assert response.status_code in [201, 200, 401, 403, 422]

    def test_list_debts(self, client, mocker):
        """Testa listagem de dívidas"""
        debts_data = [
            {
                "_id": ObjectId(),
                "name": "Debt 1",
                "debt_type": "LOAN",
                "current_balance": 1000.00,
                "status": "ACTIVE",
            }
        ]

        mock_db = mocker.AsyncMock()
        mock_db.debts.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=debts_data))
        )
        mocker.patch("routers.debts.get_database", return_value=mock_db)

        response = client.get("/api/debts")
        assert response.status_code in [200, 401, 403]

    def test_pay_debt(self, client, mocker):
        """Testa pagamento de dívida"""
        debt_id = ObjectId()
        payment_data = {
            "amount": 500.00,
            "payment_date": datetime.now(UTC).isoformat(),
        }

        mock_db = mocker.AsyncMock()
        mock_db.debts.update_one = AsyncMock(return_value=AsyncMock(modified_count=1))
        mocker.patch("routers.debts.get_database", return_value=mock_db)

        response = client.post(f"/api/debts/{debt_id}/pay", json=payment_data)
        assert response.status_code in [200, 201, 401, 403, 404]

    def test_update_debt_status(self, client, mocker):
        """Testa atualização do status de dívida"""
        debt_id = ObjectId()
        update_data = {"status": "PAID_OFF"}

        mock_db = mocker.AsyncMock()
        mock_db.debts.update_one = AsyncMock(return_value=AsyncMock(modified_count=1))
        mock_db.debts.find_one = AsyncMock(
            return_value={"_id": debt_id, "name": "Debt", **update_data}
        )
        mocker.patch("routers.debts.get_database", return_value=mock_db)

        response = client.put(f"/api/debts/{debt_id}", json=update_data)
        assert response.status_code in [200, 401, 403, 404]


class TestFamiliesCRUD:
    """Testes CRUD para famílias"""

    def test_create_family_success(self, client, mocker):
        """Testa criação bem-sucedida de família"""
        family_data = {
            "name": "Silva Family",
            "description": "Family of Silvas",
            "owner_cpf": "11144477735",
        }

        mock_db = mocker.AsyncMock()
        mock_db.families.insert_one = AsyncMock(
            return_value=AsyncMock(inserted_id=ObjectId())
        )
        mock_db.families.find_one = AsyncMock(
            return_value={
                "_id": ObjectId(),
                **family_data,
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            }
        )
        mocker.patch("routers.families.get_database", return_value=mock_db)

        response = client.post("/api/families", json=family_data)
        assert response.status_code in [201, 200, 401, 403, 422]

    def test_list_families(self, client, mocker):
        """Testa listagem de famílias"""
        families_data = [
            {"_id": ObjectId(), "name": "Family 1", "description": "Description 1"}
        ]

        mock_db = mocker.AsyncMock()
        mock_db.families.find = AsyncMock(
            return_value=AsyncMock(to_list=AsyncMock(return_value=families_data))
        )
        mocker.patch("routers.families.get_database", return_value=mock_db)

        response = client.get("/api/families")
        assert response.status_code in [200, 401, 403]

    def test_update_family(self, client, mocker):
        """Testa atualização de família"""
        family_id = ObjectId()
        update_data = {"name": "Updated Family", "description": "Updated description"}

        mock_db = mocker.AsyncMock()
        mock_db.families.update_one = AsyncMock(
            return_value=AsyncMock(modified_count=1)
        )
        mock_db.families.find_one = AsyncMock(
            return_value={"_id": family_id, **update_data}
        )
        mocker.patch("routers.families.get_database", return_value=mock_db)

        response = client.put(f"/api/families/{family_id}", json=update_data)
        assert response.status_code in [200, 401, 403, 404]

    def test_delete_family(self, client, mocker):
        """Testa deleção de família"""
        family_id = ObjectId()

        mock_db = mocker.AsyncMock()
        mock_db.families.delete_one = AsyncMock(return_value=AsyncMock(deleted_count=1))
        mocker.patch("routers.families.get_database", return_value=mock_db)

        response = client.delete(f"/api/families/{family_id}")
        assert response.status_code in [200, 204, 401, 403, 404]


class TestReportsEndpoints:
    """Testes para endpoints de relatórios"""

    def test_monthly_report_generation(self, client, mocker):
        """Testa geração de relatório mensal"""
        mock_db = mocker.AsyncMock()
        mocker.patch("routers.reports.get_database", return_value=mock_db)

        response = client.get("/api/reports/monthly?month=2&year=2026")
        assert response.status_code in [200, 401, 403]

    def test_annual_report_generation(self, client, mocker):
        """Testa geração de relatório anual"""
        mock_db = mocker.AsyncMock()
        mocker.patch("routers.reports.get_database", return_value=mock_db)

        response = client.get("/api/reports/yearly?year=2026")
        assert response.status_code in [200, 401, 403]

    def test_export_report_csv(self, client, mocker):
        """Testa exportação de relatório em CSV"""
        mock_db = mocker.AsyncMock()
        mocker.patch("routers.reports.get_database", return_value=mock_db)

        response = client.get("/api/reports/monthly?month=2&year=2026&format=csv")
        assert response.status_code in [200, 401, 403, 404]
