from typing import Any


FORMULA_PREFIXES = ("=", "+", "-", "@")


def protect_formula_injection(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    if value.lstrip().startswith(FORMULA_PREFIXES):
        return f"'{value}"
    return value
