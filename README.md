# grpc-telemetry-monorepo

A polyglot distributed systems monorepo bridging a **Node.js/TypeScript API Gateway** and a **Python gRPC Data Processing Service** using binary Protocol Buffers (`protobuf`).

```
                              ┌────────────────────────────────────────┐
                              │           Client / Browser             │
                              └───────────────────┬────────────────────┘
                                                  │ HTTP / REST (JSON)
                                                  ▼
                              ┌────────────────────────────────────────┐
                              │         gateway/ (Node.js/TS)          │
                              │           - Express REST API           │
                              │           - Interactive Dashboard      │
                              │           - gRPC Client Adapter        │
                              └───────────────────┬────────────────────┘
                                                  │ gRPC (HTTP/2 + Protobuf)
                                                  │ Binary Payload
                                                  ▼
                              ┌────────────────────────────────────────┐
                              │       data-service/ (Python)           │
                              │           - gRPC Server                │
                              │           - NumPy Statistical Engine   │
                              │           - Percentile & Metrics Crunch│
                              └────────────────────────────────────────┘
                                                  ▲
                                                  │ Single Contract
                                      ┌───────────┴───────────┐
                                      │ proto/telemetry.proto │
                                      └───────────────────────┘
```

---

## Monorepo Structure

```text
grpc-telemetry-monorepo/
├── proto/              # Shared Protocol Buffer definitions (Single Source of Truth)
│   └── telemetry.proto
├── gateway/            # Node.js + TypeScript REST API Gateway & Web Dashboard
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── data-service/       # Python gRPC Statistical Computation Service
│   ├── server.py
│   ├── requirements.txt
│   └── codegen.py
├── scripts/            # Monorepo automation and sparse-checkout helpers
└── README.md
```

---

## Sparse Checkout Workflow

In a large monorepo, developers frequently want to isolate only the services they are actively working on while preserving the shared contracts and full git history.

### Initialize Sparse Checkout
```bash
git sparse-checkout init --cone
```

### Work only on Python Data Service (+ Shared Protos)
```bash
git sparse-checkout set proto data-service
```

### Work only on Node.js Gateway (+ Shared Protos)
```bash
git sparse-checkout set proto gateway
```

### Restore Full Monorepo Checkout
```bash
git sparse-checkout disable
```

---

## Getting Started

### 1. Python Data Service
```bash
cd data-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python codegen.py
python server.py
```

### 2. Node.js Gateway
```bash
cd gateway
npm install
npm run dev
```

### 3. Access Dashboard & REST API
- Web UI: `http://localhost:3000`
- REST Endpoint: `POST http://localhost:3000/api/metrics/calculate`
- Health Endpoint: `GET http://localhost:3000/api/health`
