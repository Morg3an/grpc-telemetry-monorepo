"""
Unit and integration tests for Python gRPC Data Service.
"""

import sys
import time
from pathlib import Path
import numpy as np
import pytest
import grpc

current_dir = Path(__file__).resolve().parent
generated_dir = current_dir / "generated"
if str(generated_dir) not in sys.path:
    sys.path.insert(0, str(generated_dir))

import telemetry_pb2
import telemetry_pb2_grpc
from server import TelemetryServiceServicer, create_server


class MockContext:
    """Mock gRPC context for direct servicer testing."""
    def __init__(self):
        self.code = None
        self.details = None

    def set_code(self, code):
        self.code = code

    def set_details(self, details):
        self.details = details


def test_calculate_metrics_basic():
    servicer = TelemetryServiceServicer()
    data = [10.0, 20.0, 30.0, 40.0, 50.0]
    request = telemetry_pb2.MetricsRequest(
        metric_id="test_sensor",
        data_points=data,
        metadata={"unit": "celsius", "host": "edge-01"},
        timestamp=int(time.time() * 1000),
    )
    context = MockContext()
    response = servicer.CalculateMetrics(request, context)

    assert response.metric_id == "test_sensor"
    assert response.count == 5
    assert response.sum == pytest.approx(150.0)
    assert response.min == pytest.approx(10.0)
    assert response.max == pytest.approx(50.0)
    assert response.mean == pytest.approx(30.0)
    assert response.median == pytest.approx(30.0)
    assert response.standard_deviation == pytest.approx(np.std(data))
    assert response.variance == pytest.approx(np.var(data))
    assert response.percentiles.p50 == pytest.approx(30.0)
    assert response.metadata["unit"] == "celsius"
    assert response.metadata["host"] == "edge-01"
    assert response.processing_time_ms > 0


def test_calculate_metrics_empty():
    servicer = TelemetryServiceServicer()
    request = telemetry_pb2.MetricsRequest(
        metric_id="empty_metric",
        data_points=[],
    )
    context = MockContext()
    response = servicer.CalculateMetrics(request, context)

    assert response.metric_id == "empty_metric"
    assert response.count == 0
    assert response.sum == 0.0
    assert response.min == 0.0
    assert response.max == 0.0
    assert response.mean == 0.0
    assert response.median == 0.0
    assert response.standard_deviation == 0.0
    assert response.variance == 0.0


def test_calculate_metrics_single_point():
    servicer = TelemetryServiceServicer()
    request = telemetry_pb2.MetricsRequest(
        metric_id="single_point",
        data_points=[42.0],
    )
    context = MockContext()
    response = servicer.CalculateMetrics(request, context)

    assert response.count == 1
    assert response.sum == 42.0
    assert response.min == 42.0
    assert response.max == 42.0
    assert response.mean == 42.0
    assert response.median == 42.0
    assert response.standard_deviation == 0.0
    assert response.variance == 0.0


def test_calculate_metrics_large_dataset():
    servicer = TelemetryServiceServicer()
    np.random.seed(42)
    large_data = np.random.normal(loc=100.0, scale=15.0, size=50000).tolist()

    request = telemetry_pb2.MetricsRequest(
        metric_id="large_scale_telemetry",
        data_points=large_data,
    )
    context = MockContext()
    response = servicer.CalculateMetrics(request, context)

    assert response.count == 50000
    assert response.mean == pytest.approx(100.0, abs=0.5)
    assert response.standard_deviation == pytest.approx(15.0, abs=0.5)
    assert response.processing_time_ms < 100.0  # NumPy should compute 50k points in < 100ms


def test_check_health():
    servicer = TelemetryServiceServicer()
    request = telemetry_pb2.HealthRequest(client_name="test_runner")
    context = MockContext()
    response = servicer.CheckHealth(request, context)

    assert response.status == telemetry_pb2.HealthResponse.Status.HEALTHY
    assert response.service_name == "python-telemetry-cruncher"
    assert response.version == "1.1.0"
    assert response.uptime_seconds >= 0


def test_grpc_end_to_end_socket():
    """Verify live gRPC client communicating with gRPC server over TCP socket."""
    test_port = 50059
    server, bind_address = create_server(host="127.0.0.1", port=test_port)
    server.start()

    try:
        with grpc.insecure_channel(f"127.0.0.1:{test_port}") as channel:
            stub = telemetry_pb2_grpc.TelemetryServiceStub(channel)

            # Test Health RPC
            health_res = stub.CheckHealth(telemetry_pb2.HealthRequest(client_name="socket_test"))
            assert health_res.status == telemetry_pb2.HealthResponse.Status.HEALTHY

            # Test Metrics RPC
            data = [2.5, 3.5, 4.0, 5.0, 10.0]
            req = telemetry_pb2.MetricsRequest(
                metric_id="socket_metric",
                data_points=data,
                metadata={"test": "true"}
            )
            metrics_res = stub.CalculateMetrics(req)

            assert metrics_res.count == 5
            assert metrics_res.sum == pytest.approx(25.0)
            assert metrics_res.min == pytest.approx(2.5)
            assert metrics_res.max == pytest.approx(10.0)
            assert metrics_res.mean == pytest.approx(5.0)
    finally:
        server.stop(grace=0)
