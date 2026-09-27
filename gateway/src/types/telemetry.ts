/**
 * TypeScript definitions matching proto/telemetry.proto contract.
 */

import * as grpc from '@grpc/grpc-js';

export interface Percentiles {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface MetricsRequest {
  metric_id: string;
  data_points: number[];
  metadata?: Record<string, string>;
  timestamp?: number;
}

export interface MetricsResponse {
  metric_id: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  standard_deviation: number;
  variance: number;
  percentiles: Percentiles;
  processing_time_ms: number;
  timestamp: number;
  metadata?: Record<string, string>;
}

export enum ServingStatus {
  UNKNOWN = 0,
  HEALTHY = 1,
  DEGRADED = 2,
}

export interface HealthRequest {
  client_name: string;
}

export interface HealthResponse {
  status: ServingStatus;
  service_name: string;
  version: string;
  uptime_seconds: number;
}

/**
 * Service stub contract definition for gRPC TelemetryService
 */
export interface TelemetryServiceGrpcClient extends grpc.Client {
  calculateMetrics(
    argument: MetricsRequest,
    metadata: grpc.Metadata,
    options: Partial<grpc.CallOptions>,
    callback: (error: grpc.ServiceError | null, response: MetricsResponse) => void
  ): grpc.ClientUnaryCall;

  calculateMetrics(
    argument: MetricsRequest,
    callback: (error: grpc.ServiceError | null, response: MetricsResponse) => void
  ): grpc.ClientUnaryCall;

  checkHealth(
    argument: HealthRequest,
    metadata: grpc.Metadata,
    options: Partial<grpc.CallOptions>,
    callback: (error: grpc.ServiceError | null, response: HealthResponse) => void
  ): grpc.ClientUnaryCall;

  checkHealth(
    argument: HealthRequest,
    callback: (error: grpc.ServiceError | null, response: HealthResponse) => void
  ): grpc.ClientUnaryCall;
}

export interface CalculationResult {
  metrics: MetricsResponse;
  gatewayTiming: {
    grpcRoundtripMs: number;
    totalGatewayMs: number;
    estimatedJsonBytes: number;
    estimatedProtobufBytes: number;
  };
}
