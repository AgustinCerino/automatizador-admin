from pydantic import BaseModel, PositiveInt


class ConciliacionArchivosSelection(BaseModel):
    archivo_a_id: PositiveInt
    archivo_b_id: PositiveInt
