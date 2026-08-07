module.exports = ({ config }) => ({
  ...config,
  owner: process.env.EAS_OWNER,
});
