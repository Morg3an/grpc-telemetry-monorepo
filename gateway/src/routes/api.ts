import { Router, Request, Response } from 'express';
import {
  callCalculateMetrics,
  callCheckHealth,
  calculatePayloadEfficiency,
} from '../grpc/client';

export const apiRouter = Router();

// POST /api/metrics/calculate
apiRouter.post('/metrics/calculate', async (req: Request, res: Response) => {
  const startTime = process.hrtime.bigint();

  try {
    const rawData = req.body;

    // Support camelCase or snake_case
    const metricId = String(rawData.metricId || rawData.metric_id || 'telemetry_metric');
    const rawPoints = rawData.dataPoints ?? rawData.data_points ?? rawData.data;
    const metadata = (typeof rawData.metadata === 'object' && rawData.metadata !== null)
      ? rawData.metadata
      : {};

    if (!Array.isArray(rawPoints)) {
      return res.status(400).json({
        success: false,
        error: "Field 'dataPoints' (or 'data') must be an array of numeric values.",
      });
    }

    // Convert and sanitize points
    const dataPoints: number[] = [];
    for (let i = 0; i < rawPoints.length; i++) {
      const val = Number(rawPoints[i]);
      if (isNaN(val)) {
        return res.status(400).json({
          success: false,
          error: `Invalid numeric value at index ${i}: ${rawPoints[i]}`,
        });
      }
      dataPoints.push(val);
    }

    const efficiency = calculatePayloadEfficiency(dataPoints, metricId);

    // Call Python gRPC service over HTTP/2 Protobuf channel
    const grpcStart = process.hrtime.bigint();
    const grpcResponse = await callCalculateMetrics({
      metric_id: metricId,
      data_points: dataPoints,
      metadata: metadata,
      timestamp: Date.now(),
    });
    const grpcEnd = process.hrtime.bigint();
    const grpcRoundtripMs = Number(grpcEnd - grpcStart) / 1_000_000;

    const totalEnd = process.hrtime.bigint();
    const totalGatewayMs = Number(totalEnd - startTime) / 1_000_000;

    return res.json({
      success: true,
      data: {
        metricId: grpcResponse.metric_id,
        count: Number(grpcResponse.count),
        sum: grpcResponse.sum,
        min: grpcResponse.min,
        max: grpcResponse.max,
        mean: grpcResponse.mean,
        median: grpcResponse.median,
        standardDeviation: grpcResponse.standard_deviation,
        variance: grpcResponse.variance,
        percentiles: grpcResponse.percentiles,
        cruncherProcessingTimeMs: grpcResponse.processing_time_ms,
        timestamp: grpcResponse.timestamp,
        metadata: grpcResponse.metadata,
      },
      performance: {
        grpcRoundtripMs: Number(grpcRoundtripMs.toFixed(3)),
        totalGatewayMs: Number(totalGatewayMs.toFixed(3)),
        protocolEfficiency: efficiency,
      },
    });
  } catch (error: any) {
    const totalEnd = process.hrtime.bigint();
    const totalGatewayMs = Number(totalEnd - startTime) / 1_000_000;

    const isGrpcUnavailable = error?.code === 14; // UNAVAILABLE
    const statusCode = isGrpcUnavailable ? 503 : 500;

    return res.status(statusCode).json({
      success: false,
      error: error?.message || 'Internal gateway error during gRPC dispatch',
      details: isGrpcUnavailable
        ? 'Python gRPC Data Service is unreachable. Ensure data-service/server.py is running on port 50051.'
        : undefined,
      totalGatewayMs: Number(totalGatewayMs.toFixed(3)),
    });
  }
});

// GET /api/health
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const healthData: Record<string, any> = {
    gateway: {
      status: 'UP',
      service: 'node-api-gateway',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
    },
    dataService: {
      status: 'UNKNOWN',
    },
  };

  try {
    const grpcHealth = await callCheckHealth('node-gateway-health-check');
    healthData.dataService = {
      status: grpcHealth.status === 1 ? 'UP' : 'DEGRADED',
      service: grpcHealth.service_name,
      version: grpcHealth.version,
      uptimeSeconds: Number(grpcHealth.uptime_seconds),
    };
    return res.json({ status: 'HEALTHY', ...healthData });
  } catch (err: any) {
    healthData.dataService = {
      status: 'DOWN',
      error: err.message || 'Connection refused to gRPC data cruncher',
    };
    return res.status(503).json({ status: 'DEGRADED', ...healthData });
  }
});

// GET /api/sample-datasets
apiRouter.get('/sample-datasets', (_req: Request, res: Response) => {
  // Generate repeatable deterministic distributions for testing
  const generateNormal = (count: number, mean: number, std: number): number[] => {
    const values: number[] = [];
    for (let i = 0; i < count; i += 2) {
      // Box-Muller transform
      const u1 = Math.random() || 0.0001;
      const u2 = Math.random() || 0.0001;
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
      values.push(Number((mean + z0 * std).toFixed(2)));
      if (values.length < count) {
        values.push(Number((mean + z1 * std).toFixed(2)));
      }
    }
    return values;
  };

  res.json({
    datasets: [
      {
        id: 'iot_temp_sensors',
        name: 'IoT Datacenter Temperature (°C)',
        description: '1,000 thermal sensor telemetry readings from edge rack sensors (Mean ~23.5°C)',
        count: 1000,
        metadata: { unit: 'celsius', facility: 'dc-oregon-zone2' },
        data: generateNormal(1000, 23.5, 3.2),
      },
      {
        id: 'k8s_cpu_utilization',
        name: 'Kubernetes Cluster CPU Usage (%)',
        description: '2,500 CPU metric spikes from microservice pods under simulated peak load',
        count: 2500,
        metadata: { cluster: 'prod-us-east', namespace: 'checkout' },
        data: generateNormal(2500, 68.4, 14.8).map(v => Math.max(5, Math.min(100, v))),
      },
      {
        id: 'api_latency_ms',
        name: 'Distributed Edge Gateway Latency (ms)',
        description: '5,000 global request roundtrip latency samples with a long-tail distribution',
        count: 5000,
        metadata: { protocol: 'http/2', edgeRegion: 'ap-southeast-1' },
        data: generateNormal(5000, 48.0, 18.5).map(v => Math.max(4.2, v)),
      },
      {
        id: 'hft_market_tick_volume',
        name: 'High-Frequency Financial Ticks (Shares)',
        description: '10,000 tick trade volumes to stress test high-volume binary payload throughput',
        count: 10000,
        metadata: { market: 'NASDAQ', symbol: 'NVDA' },
        data: generateNormal(10000, 1250, 450).map(v => Math.max(10, Math.round(v))),
      },
    ],
  });
});
