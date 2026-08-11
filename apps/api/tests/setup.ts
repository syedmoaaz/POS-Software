process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ?? "mongodb://127.0.0.1:27017/mega_modern_pos_test";
process.env.ACCESS_TOKEN_SECRET = "test-access-secret-change";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-change";
process.env.CORS_ORIGIN = "http://localhost:5173";
process.env.LOG_LEVEL = "silent";
process.env.PORT = "4010";
