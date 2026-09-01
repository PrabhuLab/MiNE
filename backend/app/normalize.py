import math
from collections.abc import Iterable


def finite_or_none(value):
    if isinstance(value, (int, str)):
        return value
    number = float(value)
    return number if math.isfinite(number) else None


def finite_array(values: Iterable) -> list[float | int | str | None]:
    return [finite_or_none(value) for value in values]


def normalize_positions(coordinates: list[tuple[float, float]], enabled: bool = True) -> tuple[list[float], list[float]]:
    if not coordinates:
        return [], []
    cleaned = [(float(x), float(y)) if math.isfinite(float(x)) and math.isfinite(float(y)) else (0.0, 0.0) for x, y in coordinates]
    center_x = sum(x for x, _ in cleaned) / len(cleaned)
    center_y = sum(y for _, y in cleaned) / len(cleaned)
    centered = [(x - center_x, y - center_y) for x, y in cleaned]
    scale = max((max(abs(x), abs(y)) for x, y in centered), default=0.0)
    if not enabled or scale <= 1e-15:
        scale = 1.0
    # Six decimal places materially improves gzip ratios without visible loss.
    return (
        [round(x / scale, 6) for x, _ in centered],
        [round(y / scale, 6) for _, y in centered],
    )
