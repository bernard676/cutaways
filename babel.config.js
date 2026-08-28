// Expo resolves babel-preset-expo automatically for Metro, but jest-expo's babel-jest
// transform needs an explicit project babel config. Keep this minimal -- Metro still owns
// the real build config.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
