# Voice Analytics dbt Models

This folder contains dashboard-ready fact models for Lightdash:

- `fct_voice_attempts`
- `fct_strategy_effectiveness`

## Quick setup

1. Install dbt for Postgres/Supabase:

```bash
pip install dbt-postgres
```

2. Add a dbt profile named `voice_analytics` in `~/.dbt/profiles.yml`:

```yml
voice_analytics:
  target: dev
  outputs:
    dev:
      type: postgres
      host: <SUPABASE_DB_HOST>
      user: postgres
      pass: <SUPABASE_DB_PASSWORD>
      port: 5432
      dbname: postgres
      schema: analytics
      threads: 4
      sslmode: require
```

3. Build models:

```bash
cd analytics/dbt
dbt debug
dbt run
dbt test
```

4. In Lightdash, connect this dbt project and use:

- `fct_voice_attempts` for attempt-level exploration
- `fct_strategy_effectiveness` for strategy reward and context performance
