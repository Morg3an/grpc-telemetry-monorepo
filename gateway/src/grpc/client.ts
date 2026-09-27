import * as path from 'path';
import * as fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import {
  MetricsRequest,
  MetricsResponse,
  HealthRequest,
  HealthResponse,
  TelemetryServiceGrpcClient,
} from '../types/telemetry';

// Locate proto file with fallbacks for development (tsx) and compiled (dist) modes
function resolveProtoPath(): string {
  const candidatePaths = [
    process.env.PROTO_PATH,
    path.resolve(__dirname, '../../../proto/telemetry.proto'),
    path.resolve(__dirname, '../../proto/telemetry.proto'),
    path.resolve(process.cwd(), 'proto/telemetry.proto'),
    path.resolve(process.cwd(), '../proto/telemetry.proto'),
  ];

  for (const candidate of candidatePaths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to locate proto/telemetry.proto in candidates:\n${candidatePaths.filter(Boolean).join('\n')}`
  );
}

const protoPath = resolveProtoPath();

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const TelemetryServiceClientConstructor = protoDescriptor.telemetry.TelemetryService;

const targetUrl = process.env.DATA_SERVICE_URL || '127.0.0.1:50051';

export const grpcClient: TelemetryServiceGrpcClient = new TelemetryServiceClientConstructor(
  targetUrl,
  grpc.credentials.createInsecure(),
  {
    'grpc.max_receive_message_length': 50 * 1024 * 1024,
    'grpc.max_send_message_length': 50 * 1024 * 1024,
  }
);

/**
 * Invoke CalculateMetrics RPC on the Python gRPC server.
 */
export function callCalculateMetrics(request: MetricsRequest): Promise<MetricsResponse> {
  return new Promise((resolve, reject) => {
    const payload: MetricsRequest = {
      metric_id: request.metric_id,
      data_points: request.data_points,
      metadata: request.metadata || {},
      timestamp: request.timestamp || Date.now(),
    };

    grpcClient.calculateMetrics(payload, (error, response) => {
      if (error) {
        return reject(error);
      }
      resolve(response);
    });
  });
}

/**
 * Invoke CheckHealth RPC on the Python gRPC server.
 */
export function callCheckHealth(clientName = 'node-gateway'): Promise<HealthResponse> {
  return new Promise((resolve, reject) => {
    const payload: HealthRequest = { client_name: clientName };
    grpcClient.checkHealth(payload, (error, response) => {
      if (error) {
        return reject(error);
      }
      resolve(response);
    });
  });
}

/**
 * Estimate payload sizes comparing REST (JSON string) vs Protobuf binary encoding
 */
export function calculatePayloadEfficiency(dataPoints: number[], metricId: string) {
  // Approximate JSON byte size
  const jsonString = JSON.stringify({
    metric_id: metricId,
    data_points: dataPoints,
    timestamp: Date.now(),
  });
  const jsonBytes = Buffer.byteLength(jsonString, 'utf8');

  // Protobuf binary size:
  // Key overhead + packed double array: tag (1 byte) + varint length (1-4 bytes) + (dataPoints.length * 8 bytes)
  const tagAndHeaderBytes = 16;
  const protoBytes = tagAndHeaderBytes + (dataPoints.length * 8);

  const savingsBytes = Math.max(0, jsonBytes - protoBytes);
  const savingsPercent = jsonBytes > 0 ? ((savingsBytes / jsonBytes) * 100).toFixed(1) : '0';

  return {
    jsonBytes,
    protoBytes,
    savingsBytes,
    savingsPercent: `${savingsPercent}%`,
  };
}
