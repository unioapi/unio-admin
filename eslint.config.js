import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
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
      // `_` 前缀 = 有意未用（参数/解构/catch），与项目惯例一致，不报未用。
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // 以下三条为 dev 期 / React Compiler 建议类规则，对本项目既有惯例过严，全项目统一放宽
      // （原先仅对 shadcn ui/** 豁免，理由相同，这里扩展到全项目）：
      //   - only-export-components：纯 Vite Fast-Refresh 优化，无运行时影响；项目普遍在组件文件旁
      //     并列导出列定义 / 常量 / 小工具（os-columns、chart-common、rate-limit-input 等）。
      //   - set-state-in-effect：项目大量使用「弹窗按 open 回填表单」「筛选变更重置分页」「服务端数据
      //     初始化本地表单」等受保护的对外同步 effect，均为合理写法。
      //   - incompatible-library：TanStack Table useReactTable 返回的函数无法被 React Compiler 安全记忆化，
      //     属库限制、非本项目代码问题。
      'react-refresh/only-export-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
  // 类型声明 / 模块增强文件：为 TanStack Table 等做增强时 any 是既定逃生舱（见文件内 GitHub issue 链接）。
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'e2e/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
