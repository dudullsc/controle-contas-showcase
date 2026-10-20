"""Extract payment total from receipt images/PDFs via Gemini."""

from __future__ import annotations

import asyncio
import json
import re
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeout
from typing import Any

from config import settings

DIFF_THRESHOLD = 0.01  # qualquer centavo de diferença
PER_MODEL_TIMEOUT_SEC = 16.0
OVERALL_TIMEOUT_SEC = 55.0

PROMPT = """Você analisa um comprovante de pagamento brasileiro (Pix, boleto, TED, transferências de bancos diversos).

Extraia TODOS os valores monetários visíveis em reais (R$).
O valor TOTAL pago costuma ser o MAIOR valor do documento (inclui juros/multa se houver).

Responda APENAS JSON válido, sem markdown:
{"amounts":[120.50, 100.00],"total":120.50}

Regras:
- amounts: lista de números (ponto decimal)
- total: o maior valor da lista (total pago)
- Ignore CNPJ, CPF, datas, códigos e IDs numéricos que não sejam dinheiro
- Se não houver valor claro: {"amounts":[],"total":null}
"""


def is_configured() -> bool:
    return bool(settings.gemini_api_key and settings.gemini_api_key.strip())


def _model_chain() -> list[str]:
    """Primary first, then lite/fast fallbacks (better under high demand)."""
    models: list[str] = []
    primary = (settings.gemini_model or "").strip()
    if primary:
        models.append(primary)

    preferred_fast = [
        "gemini-3.1-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3-flash-preview",
        "gemini-3.6-flash",
    ]
    raw = (settings.gemini_fallback_models or "").strip()
    from_env = [p.strip() for p in raw.split(",") if p.strip()] if raw else []

    for name in preferred_fast + from_env:
        if name and name not in models:
            models.append(name)

    return models or ["gemini-flash-latest"]


def _parse_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        n = float(value)
        return round(n, 2) if n > 0 else None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        s = re.sub(r"[^\d,.\-]", "", s)
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            s = s.replace(",", ".")
        try:
            n = float(s)
            return round(n, 2) if n > 0 else None
        except ValueError:
            return None
    return None


def _parse_response_text(text: str) -> float | None:
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        found = re.findall(r"\d+[.,]\d{2}|\d+", cleaned)
        nums = [_parse_number(x) for x in found]
        nums = [n for n in nums if n is not None]
        return max(nums) if nums else None

    amounts_raw = payload.get("amounts") or []
    amounts: list[float] = []
    if isinstance(amounts_raw, list):
        for item in amounts_raw:
            n = _parse_number(item)
            if n is not None:
                amounts.append(n)

    total = _parse_number(payload.get("total"))
    if amounts:
        biggest = max(amounts)
        if total is None or total < biggest:
            total = biggest
    return total


def _generate_with_model(
    client: Any, types: Any, model: str, data: bytes, mime_type: str
) -> float | None:
    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=data, mime_type=mime_type),
            PROMPT,
        ],
        config=types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )
    text = getattr(response, "text", None) or ""
    if not text and getattr(response, "candidates", None):
        parts = response.candidates[0].content.parts
        text = "".join(getattr(p, "text", "") or "" for p in parts)
    return _parse_response_text(text)


def _call_gemini_sync(data: bytes, mime_type: str) -> float | None:
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        print(
            "⚠️  Pacote google-genai não instalado no venv do backend "
            f"(pip install google-genai): {exc}"
        )
        return None

    client = genai.Client(api_key=settings.gemini_api_key)
    last_error: Exception | None = None

    with ThreadPoolExecutor(max_workers=1) as pool:
        for model in _model_chain():
            fut = pool.submit(
                _generate_with_model, client, types, model, data, mime_type
            )
            try:
                detected = fut.result(timeout=PER_MODEL_TIMEOUT_SEC)
            except FuturesTimeout:
                print(
                    f"⚠️  Gemini modelo {model} timeout "
                    f"({PER_MODEL_TIMEOUT_SEC:.0f}s) — tentando próximo"
                )
                last_error = TimeoutError(model)
                continue
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                print(f"⚠️  Gemini modelo {model} falhou: {exc}")
                continue

            if detected is not None:
                print(f"✅ Gemini comprovante: R$ {detected:.2f} (modelo {model})")
                return detected
            last_error = RuntimeError(f"Resposta sem valor (modelo {model})")
            print(f"⚠️  Gemini modelo {model}: resposta sem valor")

    if last_error:
        print(f"⚠️  Gemini receipt parse falhou: {last_error}")
    return None


async def detect_receipt_total(data: bytes, mime_type: str) -> float | None:
    """Return detected payment total or None if unavailable."""
    if not is_configured():
        return None
    if not data:
        return None
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_call_gemini_sync, data, mime_type),
            timeout=OVERALL_TIMEOUT_SEC,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  Gemini receipt timeout/erro: {type(exc).__name__}: {exc}")
        return None


def build_amount_check(
    expense_amount: float, detected_amount: float | None
) -> dict[str, Any] | None:
    if detected_amount is None:
        return None
    expense_amount = round(float(expense_amount), 2)
    detected_amount = round(float(detected_amount), 2)
    differs = abs(detected_amount - expense_amount) >= DIFF_THRESHOLD
    return {
        "detected_amount": detected_amount,
        "expense_amount": expense_amount,
        "differs": differs,
    }
