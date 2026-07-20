# Nyxwire Kubernetes (local / kind)

MVP manifests for **local clusters only**. Cloud (AKS, GKE, EKS) is **SIM** — not applied from this path by default. Comments and this note are the only cloud posture; do not apply paid clusters from SE-005 defaults.

## Prerequisites

- `kubectl` + kind/k3d/minikube
- Images built and tagged `0.1.0`, then loaded into kind:

```bash
docker compose build
docker tag nyxwire-streaming:latest nyxwire-streaming:0.1.0
docker tag nyxwire-history:latest nyxwire-history:0.1.0
docker tag nyxwire-storage:latest nyxwire-storage-local:0.1.0   # compose service name: storage
docker tag nyxwire-metadata:latest nyxwire-metadata:0.1.0
docker tag nyxwire-upload:latest nyxwire-upload:0.1.0
docker tag nyxwire-gateway:latest nyxwire-gateway:0.1.0
kind load docker-image nyxwire-streaming:0.1.0
kind load docker-image nyxwire-history:0.1.0
kind load docker-image nyxwire-storage-local:0.1.0
kind load docker-image nyxwire-metadata:0.1.0
kind load docker-image nyxwire-upload:0.1.0
kind load docker-image nyxwire-gateway:0.1.0
# mongo:7 and rabbitmq:3.13-management-alpine pull from registry (or preload if offline)
```

## Dry-run (client)

```bash
kubectl apply --dry-run=client -f deploy/k8s/
```

## Apply order

Recommended order: **namespace → infra (mongo/rabbit) → app backends → upload → gateway**.

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/mongo.yaml
kubectl apply -f deploy/k8s/rabbit.yaml
kubectl apply -f deploy/k8s/streaming-deployment.yaml
kubectl apply -f deploy/k8s/history-deployment.yaml
kubectl apply -f deploy/k8s/storage-local-deployment.yaml
kubectl apply -f deploy/k8s/metadata-deployment.yaml
kubectl apply -f deploy/k8s/upload-deployment.yaml
kubectl apply -f deploy/k8s/gateway-deployment.yaml
# or all at once after namespace exists:
kubectl apply -f deploy/k8s/
```

Check:

```bash
kubectl -n nyxwire get pods,svc
kubectl -n nyxwire port-forward svc/nyxwire-gateway 8080:80
curl -s localhost:8080/health
# optional: Rabbit management UI
# kubectl -n nyxwire port-forward svc/rabbit 15672:15672
```

## Lab credentials (WARNING)

| Resource | User / pass | Notes |
|----------|-------------|--------|
| RabbitMQ | **nyxwire / nyxwire** | Embedded in `rabbit.yaml` and app `RABBIT_URL`. **Lab only** — never reuse outside this sandbox. |

Mongo has no auth in this thin kind slice (open within the `nyxwire` namespace only). Do not expose Mongo/Rabbit nodePorts to the public internet.

## In-cluster service DNS

| Name | Role | Consumers |
|------|------|-----------|
| `mongo` | MongoDB `:27017` | history, metadata → `mongodb://mongo:27017` |
| `rabbit` | AMQP `:5672`, mgmt `:15672` | history, streaming → `amqp://nyxwire:nyxwire@rabbit:5672` |
| `nyxwire-storage-local` | storage API | upload, gateway |
| `nyxwire-metadata` | metadata API | upload, gateway |
| `nyxwire-upload` | upload API | gateway → `UPLOAD_URL` |
| `nyxwire-streaming` / `nyxwire-history` | stream + history | gateway |
| `nyxwire-gateway` | edge proxy `:80`→3000 | port-forward / Ingress later |

## Honest MVP limits

| Component | k8s status |
|-----------|------------|
| namespace, gateway, streaming, history, storage-local, metadata, **upload** | Manifests present |
| **mongo** | Single-replica `mongo:7`, service name `mongo`, **emptyDir** (ephemeral) |
| **rabbit** | Single-replica `rabbitmq:3.13-management-alpine`, service name `rabbit`, lab creds |
| **storage-local** volume | `emptyDir` only (ephemeral) |
| Cloud AKS/GKE/EKS | **SIM** only — not applied from this path |

## Notes

- Brand: **nyxwire** only.
- Compose remains a fast local loop; this path is the kind-shaped mirror with thin infra.
- Cloud AKS/GKE/EKS: **SIM** comments only — do not apply paid clusters from SE-005 defaults.
