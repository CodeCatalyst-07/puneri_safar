# Static Data Layer (`src/data`)

Contains verified municipal and historical reference datasets for Pune.

## Structure

- `schemas/blackspot.schema.json`: JSON Schema for accident blackspots (Pune Traffic Police accident records).
- `schemas/heritage.schema.json`: JSON Schema for archaeological and cultural heritage landmarks.
- `blackspots.json`: Seed static records for persistent accident hazard points.
- `heritage.json`: Seed static records for cultural places in Pune.

All JSON files in this directory must strictly validate against their corresponding schema in `schemas/`.
