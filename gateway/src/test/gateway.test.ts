import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app';
import { calculatePayloadEfficiency } from '../grpc/client';

describe('Node.js Gateway API Suite', () => {
  const app = createApp();

  test('GET /api/sample-datasets returns realistic test telemetry collections', async () => {
    const res = await request(app).get('/api/sample-datasets');
    assert.equal(res.status, 200);
    assert.equal(res.body.datasets.length, 4);

    const iot = res.body.datasets.find((d: any) => d.id === 'iot_temp_sensors');
    assert.ok(iot);
    assert.equal(iot.count, 1000);
    assert.equal(iot.data.length, 1000);
  });

  test('POST /api/metrics/calculate validates missing or invalid dataPoints', async () => {
    // Missing dataPoints
    const res1 = await request(app)
      .post('/api/metrics/calculate')
      .send({ metricId: 'test' });
    assert.equal(res1.status, 400);
    assert.equal(res1.body.success, false);

    // Non-numeric elements
    const res2 = await request(app)
      .post('/api/metrics/calculate')
      .send({ metricId: 'test', dataPoints: [1, 2, 'invalid_number'] });
    assert.equal(res2.status, 400);
    assert.equal(res2.body.success, false);
  });

  test('Payload efficiency calculator demonstrates Protobuf bandwidth savings', () => {
    const numbers = [12.45, 15.67, 18.92, 22.34, 25.61, 30.12, 35.88];
    const efficiency = calculatePayloadEfficiency(numbers, 'test_metric');

    assert.ok(efficiency.jsonBytes > 0);
    assert.ok(efficiency.protoBytes > 0);
    assert.ok(efficiency.jsonBytes > efficiency.protoBytes);
    assert.ok(efficiency.savingsBytes > 0);
  });

  test('GET /api/health reports gateway status', async () => {
    const res = await request(app).get('/api/health');
    assert.ok([200, 503].includes(res.status));
    assert.ok(res.body.gateway);
    assert.equal(res.body.gateway.service, 'node-api-gateway');
  });
});
