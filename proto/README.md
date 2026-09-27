# Protocol Buffers (`proto/`)

This directory houses the single source of truth for inter-service communication across the monorepo.

## Contracts
- `telemetry.proto`: Defines the `TelemetryService` RPC interface and data models for calculating statistical metrics over arrays of floating-point telemetry values.

## Usage
- **Python**: Generated using `grpcio-tools`.
- **Node.js**: Loaded dynamically via `@grpc/proto-loader` or compiled into TypeScript types.
