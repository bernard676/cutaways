// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // eslint-config-expo 57 bumped eslint-plugin-react-hooks to v7, which promotes
      // `set-state-in-effect` to an error. Several existing effects here intentionally
      // mirror a changed value into local state (generation phase -> screen mode, etc.).
      // Keep it visible as a warning rather than blocking lint on a pre-existing pattern.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
