import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.js", "*.config.ts", "packages/*/*.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.config.ts", "**/*.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  },
);
