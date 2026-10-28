module.exports = ({ config }) => ({
  ...config,
  owner: process.env.EAS_OWNER,
  // The Pages workflow serves the web build under /corridor/demo; local and
  // native builds keep the root.
  ...(process.env.EXPO_BASE_URL
    ? { experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL } }
    : {}),
});
