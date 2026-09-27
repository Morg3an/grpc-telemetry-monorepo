import { createApp } from './app';

const app = createApp();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(Number(PORT), HOST, () => {
  console.log(`=======================================================`);
  console.log(`Node.js API Gateway running at http://${HOST}:${PORT}`);
  console.log(`Forwarding gRPC requests to: ${process.env.DATA_SERVICE_URL || '127.0.0.1:50051'}`);
  console.log(`Dashboard UI: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
