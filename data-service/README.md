# Data Service (Python + gRPC)

The Data Service is a high-performance computation engine written in Python. It implements a gRPC server that accepts binary Protocol Buffer payloads, computes statistical metrics (mean, median, standard deviation, variance, min, max, percentiles), and streams or responds with structured analytics.

## Key Features
- **gRPC Server**: Native binary RPC handling over HTTP/2 using `grpcio`.
- **Fast Statistical Processing**: Vectorized calculations using NumPy and Python math modules.
- **Contract-First Architecture**: Compiled from `proto/telemetry.proto` with `grpcio-tools`.
- **Health Probing**: Real-time service status, uptime, and serving indicators.
