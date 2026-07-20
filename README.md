# Nyxwire

Stream video. Remember what was watched. One compose command on your laptop.

Nyxwire is the longitudinal product for SE-005 — a small microservices system you can run, break, and grow. Not a lab dump: clean monorepo, product naming only, local Docker first.

## Layout

```
nyxwire/
  docker-compose.yaml     # rabbit + mongo + streaming + history + gateway
  services/
    gateway/              # edge: /health, /video, /history
    streaming/            # file stream + publish "viewed"
    history/              # consume "viewed" → Mongo; list events
  docs/ARCHITECTURE.md
  .github/workflows/ci.yml
```

## Quick start

```bash
cd case-study/nyxwire

docker compose up --build -d

# edge health
curl -s http://localhost:8080/health

# stream sample (publishes a viewed event)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/video

# give the consumer a moment, then list history
sleep 2
curl -s http://localhost:8080/history

docker compose down
```

Direct service ports (handy when debugging):

| URL | Service |
|-----|---------|
| http://localhost:8080/health | gateway |
| http://localhost:4001/health | streaming |
| http://localhost:4002/health | history |
| http://localhost:15672 | RabbitMQ UI (`nyxwire` / `nyxwire`) |

## Defaults that matter

- **Mongo** holds history only. Streaming never touches it.
- **RabbitMQ** carries `viewed` events from streaming → history.
- **Gateway** is the public face; browsers and scripts can talk to `:8080` alone.
- Sample media lives at `services/streaming/videos/sample.mp4` (baked into the streaming image).

## Tests (host)

```bash
cd services/streaming
npm install
npm test
```

CI runs the same gate, then builds each service image. Registry push and cloud deploy stay commented as SIM steps — see `.github/workflows/ci.yml`.

## Docs

- [Architecture](docs/ARCHITECTURE.md) — ownership, ports, request path

## Stop

```bash
docker compose down
# wipe history volume too:
# docker compose down -v
```
