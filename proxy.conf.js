module.exports = {
  "/api-test": {
    "target": "https://fdmsapitest.zimra.co.zw",
    "secure": false,
    "changeOrigin": true,
    "pathRewrite": {
      "^/api-test": ""
    },
    "logLevel": "debug"
  },
  "/api-prod": {
    "target": "https://fdmsapi.zimra.co.zw",
    "secure": false,
    "changeOrigin": true,
    "pathRewrite": {
      "^/api-prod": ""
    },
    "logLevel": "debug"
  }
};
