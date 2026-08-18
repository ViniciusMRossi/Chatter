import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["packages/*/tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  },
);
