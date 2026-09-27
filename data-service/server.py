#!/usr/bin/env python3
"""
Python gRPC Telemetry Data Processing Service.
Computes statistical aggregates (min, max, mean, median, std dev, variance, percentiles)
over binary Protocol Buffer telemetry payloads.
"""

import os
import sys
import time
import signal
import logging
from concurrent import futures
from pathlib import Path
import numpy as np
import grpc

# Add generated directory to path for clean import resolution
current_dir = Path(__file__).resolve().parent
generated_dir = current_dir / "generated"
if str(generated_dir) not in sys.path:
    sys.path.insert(0, str(generated_dir))

try:
    import telemetry_pb2
    import telemetry_pb2_grpc
except ImportError:
    from generated import telemetry_pb2
    from generated import telemetry_pb2_grpc

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [data-service] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("data-service")


class TelemetryServiceServicer(telemetry_pb2_grpc.TelemetryServiceServicer):
    """Implementation of TelemetryService gRPC endpoints."""

    def __init__(self):
        self.service_start_time = time.time()
        self.total_requests_processed = 0
        self.total_points_processed = 0

    def CalculateMetrics(self, request, context):
        start_time = time.perf_counter()
        metric_id = request.metric_id or "unspecified_metric"
        data_points = request.data_points
        count = len(data_points)

        logger.info(
            f"Received RPC CalculateMetrics -> metric_id: '{metric_id}', "
            f"data_points: {count}, metadata: {dict(request.metadata)}"
        )

        if count == 0:
            processing_time_ms = (time.perf_counter() - start_time) * 1000.0
            return telemetry_pb2.MetricsResponse(
                metric_id=metric_id,
                count=0,
                sum=0.0,
                min=0.0,
                max=0.0,
                mean=0.0,
                median=0.0,
                standard_deviation=0.0,
                variance=0.0,
                percentiles=telemetry_pb2.Percentiles(
                    p25=0.0, p50=0.0, p75=0.0, p90=0.0, p95=0.0, p99=0.0
                ),
                processing_time_ms=processing_time_ms,
                timestamp=int(time.time() * 1000),
                metadata=dict(request.metadata),
            )

        # High-performance NumPy statistical computations
        arr = np.array(data_points, dtype=np.float64)

        sum_val = float(np.sum(arr))
        min_val = float(np.min(arr))
        max_val = float(np.max(arr))
        mean_val = float(np.mean(arr))
        median_val = float(np.median(arr))
        std_val = float(np.std(arr))
        var_val = float(np.var(arr))

        # Percentile calculations
        p25 = float(np.percentile(arr, 25))
        p50 = float(np.percentile(arr, 50))
        p75 = float(np.percentile(arr, 75))
        p90 = float(np.percentile(arr, 90))
        p95 = float(np.percentile(arr, 95))
        p99 = float(np.percentile(arr, 99))

        processing_time_ms = (time.perf_counter() - start_time) * 1000.0

        self.total_requests_processed += 1
        self.total_points_processed += count

        logger.info(
            f"Computed metrics for '{metric_id}' in {processing_time_ms:.3f}ms: "
            f"count={count}, mean={mean_val:.4f}, min={min_val:.4f}, max={max_val:.4f}, std={std_val:.4f}"
        )

        response = telemetry_pb2.MetricsResponse(
            metric_id=metric_id,
            count=count,
            sum=sum_val,
            min=min_val,
            max=max_val,
            mean=mean_val,
            median=median_val,
            standard_deviation=std_val,
            variance=var_val,
            percentiles=telemetry_pb2.Percentiles(
                p25=p25, p50=p50, p75=p75, p90=p90, p95=p95, p99=p99
            ),
            processing_time_ms=processing_time_ms,
            timestamp=int(time.time() * 1000),
            metadata=dict(request.metadata),
        )
        return response

    def CheckHealth(self, request, context):
        uptime = int(time.time() - self.service_start_time)
        logger.info(
            f"Health check probe received from '{request.client_name}'. "
            f"Uptime: {uptime}s, Requests: {self.total_requests_processed}"
        )
        return telemetry_pb2.HealthResponse(
            status=telemetry_pb2.HealthResponse.Status.HEALTHY,
            service_name="python-telemetry-cruncher",
            version="1.1.0",
            uptime_seconds=uptime,
        )


def create_server(host="0.0.0.0", port=50051, max_workers=10):
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=max_workers),
        options=[
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),
            ("grpc.max_send_message_length", 50 * 1024 * 1024),
        ],
    )
    servicer = TelemetryServiceServicer()
    telemetry_pb2_grpc.add_TelemetryServiceServicer_to_server(servicer, server)
    bind_address = f"{host}:{port}"
    server.add_insecure_port(bind_address)
    return server, bind_address


def serve():
    host = os.getenv("GRPC_HOST", "0.0.0.0")
    port = int(os.getenv("GRPC_PORT", "50051"))
    server, bind_address = create_server(host=host, port=port)

    server.start()
    logger.info(f"gRPC Python Data Service listening on {bind_address}")

    def graceful_shutdown(signum, frame):
        logger.info("Shutdown signal received. Stopping gRPC server gracefully...")
        server.stop(grace=3).wait()
        logger.info("gRPC server stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, graceful_shutdown)
    signal.signal(signal.SIGTERM, graceful_shutdown)

    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received.")
        server.stop(grace=1).wait()


if __name__ == "__main__":
    serve()
