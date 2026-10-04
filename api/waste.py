"""Separate tray returns from discarded kitchen food; percentages use 0..100."""
from datetime import date as CalendarDate
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator

class WasteItem(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    dish: str = Field(min_length=1, max_length=300)
    total_served_lbs: float = Field(ge=0)
    post_consumer_pct: float = Field(ge=0, le=100)
    unserved_units_wasted: float = Field(ge=0)
    unserved_unit: Literal['pans', 'lbs'] = 'pans'
    weight_per_pan_lbs: float = Field(gt=0)
    cost_per_lb: float | None = Field(default=None, ge=0)
    cost_per_pan: float | None = Field(default=None, ge=0)

    @model_validator(mode='after')
    def validate_cost(self):
        if self.cost_per_lb is None and self.cost_per_pan is None:
            raise ValueError('Provide cost_per_lb or cost_per_pan')
        if self.cost_per_lb is not None and self.cost_per_pan is not None:
            if abs(self.cost_per_pan - self.cost_per_lb * self.weight_per_pan_lbs) > .005:
                raise ValueError('cost_per_pan must equal cost_per_lb × weight_per_pan_lbs')
        return self

class WasteService(BaseModel):
    model_config = ConfigDict(extra='forbid')
    hall: str = Field(min_length=1, max_length=100)
    date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    meal: str = Field(min_length=1, max_length=50)
    items: list[WasteItem] = Field(max_length=2000)

    @field_validator('date')
    @classmethod
    def valid_date(cls, value):
        CalendarDate.fromisoformat(value)
        return value

class FinancialSummary(BaseModel):
    total_waste_dollars: float
    plate_waste_dollars: float
    unserved_overproduction_dollars: float
    total_waste_lbs: float
    plate_waste_lbs: float
    unserved_overproduction_lbs: float


def _d(value):
    return Decimal(str(value))


def _money(value):
    return value.quantize(Decimal('.01'), rounding=ROUND_HALF_UP)


def calculate_item(item: WasteItem):
    weight = _d(item.weight_per_pan_lbs)
    cost = _d(item.cost_per_lb) if item.cost_per_lb is not None else _d(item.cost_per_pan) / weight
    plate = _d(item.total_served_lbs) * _d(item.post_consumer_pct) / 100
    kitchen = _d(item.unserved_units_wasted) * (weight if item.unserved_unit == 'pans' else 1)
    # Round each billable vector to cents; totals sum these rounded vectors.
    plate_cost, kitchen_cost = _money(plate * cost), _money(kitchen * cost)
    return {**item.model_dump(), 'cost_per_lb': float(cost), 'cost_per_pan': float(cost * weight),
            'unserved_pans_wasted': float(kitchen / weight), 'plate_waste_lbs': float(plate),
            'unserved_overproduction_lbs': float(kitchen), 'total_waste_lbs': float(plate + kitchen),
            'plate_waste_dollars': float(plate_cost), 'unserved_overproduction_dollars': float(kitchen_cost),
            'total_waste_dollars': float(plate_cost + kitchen_cost)}


def financial_summary(items):
    rows = [calculate_item(i) for i in items]
    plate = sum((_d(r['plate_waste_dollars']) for r in rows), Decimal(0))
    kitchen = sum((_d(r['unserved_overproduction_dollars']) for r in rows), Decimal(0))
    plate_lbs = sum(r['plate_waste_lbs'] for r in rows)
    kitchen_lbs = sum(r['unserved_overproduction_lbs'] for r in rows)
    return FinancialSummary(total_waste_dollars=float(plate+kitchen), plate_waste_dollars=float(plate),
        unserved_overproduction_dollars=float(kitchen), total_waste_lbs=plate_lbs+kitchen_lbs,
        plate_waste_lbs=plate_lbs, unserved_overproduction_lbs=kitchen_lbs)

MOCK_SERVICE = WasteService(hall='South Quad', date='2026-10-04', meal='Dinner', items=[
    WasteItem(dish='Steamed Broccoli', total_served_lbs=60, post_consumer_pct=8,
              unserved_units_wasted=2.5, weight_per_pan_lbs=10, cost_per_lb=1.8),
    WasteItem(dish='Lemon Herb Chicken', total_served_lbs=100, post_consumer_pct=30,
              unserved_units_wasted=.25, weight_per_pan_lbs=10, cost_per_lb=4.5),
    WasteItem(dish='Cooked Rice', total_served_lbs=40, post_consumer_pct=30,
              unserved_units_wasted=2, weight_per_pan_lbs=10, cost_per_lb=1.2),
])
