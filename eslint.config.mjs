import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});


export default defineConfig([globalIgnores(["docs/**/*", "examples/**/*"]), {
    extends: compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended-type-checked",
        "plugin:jest/all",
    ),

    plugins: {},

    languageOptions: {
        globals: {
            ...globals.browser,
        },

        ecmaVersion: 2017,
        sourceType: "module",
        parserOptions: {
            projectService: true,
            tsconfigRootDir: __dirname,
        },
    },

    rules: {
        "no-param-reassign": "off",
        "no-restricted-properties": "warn",
    },
}]);