# Nyxwire Kubernetes (local / kind)

MVP manifests for **local clusters only**. Cloud (AKS, GKE, EKS) is **SIM** — not applied from this path by default.

## Prerequisites

- `kubectl` + kind/k3d/minikube
- Images built: `docker compose build` then load into kind:

```bash
docker compose build
kind load docker-image nyxwire-streaming:latest   # tag as needed
# or: docker tag nyxwire-streaming nyxwire-streaming:0.1.0 && kind load docker-image nyxwire-streaming:0.1.0
```

## Apply

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/
kubectl -n nyxwire get pods,svc
kubectl -n nyxwire port-forward svc/nyxwire-gateway 8080:80
curl -s localhost:8080/health
```

## Notes

- Rabbit/Mongo full stack on k8s is a later slice; compose remains the primary local loop.
- Dry-run: `kubectl apply --dry-run=client -f deploy/k8s/`
