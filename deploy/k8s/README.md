# Nyxwire Kubernetes (local / kind)

MVP manifests for **local clusters only**. Cloud (AKS, GKE, EKS) is **SIM** — not applied from this path by default.

## Prerequisites

- `kubectl` + kind/k3d/minikube
- Images built and tagged `0.1.0`, then loaded into kind:

```bash
docker compose build
docker tag nyxwire-streaming:latest nyxwire-streaming:0.1.0
docker tag nyxwire-history:latest nyxwire-history:0.1.0
docker tag nyxwire-storage:latest nyxwire-storage-local:0.1.0   # compose service name: storage
docker tag nyxwire-metadata:latest nyxwire-metadata:0.1.0
docker tag nyxwire-gateway:latest nyxwire-gateway:0.1.0
kind load docker-image nyxwire-streaming:0.1.0
kind load docker-image nyxwire-history:0.1.0
kind load docker-image nyxwire-storage-local:0.1.0
kind load docker-image nyxwire-metadata:0.1.0
kind load docker-image nyxwire-gateway:0.1.0
```

## Dry-run (client)

```bash
kubectl apply --dry-run=client -f deploy/k8s/
```

## Apply order

Recommended order (namespace first, then backends, then gateway):

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/streaming-deployment.yaml
kubectl apply -f deploy/k8s/history-deployment.yaml
kubectl apply -f deploy/k8s/storage-local-deployment.yaml
kubectl apply -f deploy/k8s/metadata-deployment.yaml
kubectl apply -f deploy/k8s/gateway-deployment.yaml
# or all at once after namespace exists:
kubectl apply -f deploy/k8s/
```

Check:

```bash
kubectl -n nyxwire get pods,svc
kubectl -n nyxwire port-forward svc/nyxwire-gateway 8080:80
curl -s localhost:8080/health
```

## Honest MVP limits

| Component | k8s status |
|-----------|------------|
| namespace, gateway, streaming, history, storage-local, metadata | Manifests present |
| **storage-local** volume | `emptyDir` only (ephemeral) |
| **RabbitMQ** | Not deployed here — history/streaming env placeholders (`RABBIT_URL`). Use compose or external broker. |
| **MongoDB** | Not deployed here — history/metadata env placeholders (`DBHOST` / `MONGODB`). Use compose or external Mongo. |

History and metadata will not stay Ready without a reachable Rabbit/Mongo. Storage-local and gateway (proxy/health) are the most self-contained slices without that infra.

## Notes

- Brand: **nyxwire** only.
- Rabbit/Mongo full stack on k8s is a later slice; compose remains the primary local loop for the event/store path.
- Cloud AKS/GKE/EKS: **SIM** comments only — do not apply paid clusters from SE-005 defaults.
