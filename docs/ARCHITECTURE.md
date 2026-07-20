# Nyxwire architecture (MVP)

## Why this shape

Nyxwire is a small video product: stream a file, record that it was watched, expose one edge. Services own their data and talk over HTTP or a message queue — not shared databases.

## Services

| Service | Role | Store / bus |
|---------|------|-------------|
| **gateway** | Public entry, reverse proxy | — |
| **streaming** | `GET /video` file stream; publishes **viewed** | RabbitMQ publish |
| **history** | Consume **viewed**; `GET /history` | MongoDB + RabbitMQ consume |
| **rabbit** | Topic-less work queue `viewed` | — |
| **mongo** | History-only durable store | volume `nyxwire-mongo-data` |

## Request path

```
Client
  │
  ▼
gateway :8080
  ├─ /video ──────────► streaming :4001 ──publish──► rabbit ──consume──► history
  └─ /history ────────► history :4002 ──read──► mongo
```

Streaming never writes Mongo. History never serves video bytes. That keeps failure domains and ownership clear.

## Local ports

| Host port | Service |
|-----------|---------|
| 8080 | gateway |
| 4001 | streaming |
| 4002 | history |
| 5672 / 15672 | rabbit (AMQP / management UI) |
| — | mongo (compose network only) |

## Evolution (not in this MVP)

- Object storage for media instead of a baked-in sample file
- Durable queues + DLQ
- Auth at the gateway
- Per-service CI already sketched under `.github/workflows/ci.yml` (registry push / deploy remain SIM)

## Brand

Product name is **Nyxwire** only.
