import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Allow underscore-prefixed args (e.g. callback params that are intentionally unused)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // ElementsRenderer doubles as the shared types/constants module, and
      // EditorContext exports localStorage helpers — react-refresh's
      // only-export-components rule flags every one of those (it is an HMR
      // DX heuristic, not a correctness rule). The codebase convention is to
      // keep utilities alongside components; revisit when the F5 refactor
      // splits ElementsRenderer into a types module + component module.
      "react-refresh/only-export-components": "off",
    },
  },
]);
