# Gateway Service (Node.js + TypeScript)

The API Gateway acts as the public-facing entry point of the telemetry platform. It accepts incoming HTTP/REST requests, validates payloads, transforms them into high-performance binary Protocol Buffer payloads, and dispatches them to the Python data cruncher via gRPC.

## Key Features
- **TypeScript & Express**: Strongly typed REST endpoints.
- **gRPC Client**: Inter-service communication with binary Protocol Buffers using `@grpc/grpc-js` and `@grpc/proto-loader`.
- **Interactive Telemetry Dashboard**: Modern UI for testing metrics calculation, visualizing aggregates, and comparing REST vs. gRPC payloads.
- **Health Checks & Observability**: Gateway and upstream gRPC service health monitoring.
