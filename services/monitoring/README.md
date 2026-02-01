# Monitoring Stack

This directory contains all monitoring infrastructure configurations.

## Structure

```
monitoring/
├── prometheus/
│   └── prometheus.yml          # Scrape configs for all services
├── grafana/
│   └── datasources/
│       └── prometheus.yml      # Prometheus datasource
└── README.md
```

## Services

- **Prometheus**: http://localhost:9090 - Metrics storage & querying
- **Grafana**: http://localhost:3000 - Dashboards (admin/admin)
- **Redis Exporter**: http://localhost:9121 - Redis metrics

## Metrics Endpoints

All services expose `/metrics`:
- Auth: http://localhost:5000/metrics
- Game-1: http://localhost:6001/metrics
- Game-2: http://localhost:6002/metrics
- Game-3: http://localhost:6003/metrics
- Redis: http://localhost:9121/metrics

## Adding New Metrics

1. Add scrape target to `prometheus/prometheus.yml`
2. Restart Prometheus: `docker-compose restart prometheus`
3. Verify in http://localhost:9090/targets
