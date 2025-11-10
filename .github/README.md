# GitHub Actions 工作流

本目录包含Orca Link Icons Plugin的自动化工作流配置。

## 工作流概览

### 🔄 CI构建和测试 (`.github/workflows/ci.yml`)

**触发条件:**
- 推送到 `main` 或 `develop` 分支
- 针对 `main` 分支的Pull Request

**功能:**
- 多Node.js版本矩阵构建 (16.x, 18.x, 20.x)
- TypeScript类型检查
- ESLint代码检查
- 插件构建验证
- 文件大小检查
- 插件结构验证
- 构建产物上传

### 🚀 发布工作流 (`.github/workflows/release.yml`)

**触发条件:**
- 推送版本标签 (如 `v1.0.0`)

**功能:**
- 完整的构建和验证流程
- 创建插件包 (.zip文件)
- 生成更新日志
- 创建GitHub Release
- 更新package.json版本
- 发布状态通知

### 🔧 开发工作流 (`.github/workflows/dev.yml`)

**触发条件:**
- 推送到 `develop` 分支
- 针对 `develop` 分支的Pull Request
- 定时依赖检查 (每周)

**功能:**
- 开发环境检查
- 破坏性变更检测
- 开发报告生成
- 自动依赖更新

## 使用方法

### 触发发布

1. 更新版本号:
   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   npm version minor  # 1.0.0 -> 1.1.0
   npm version major  # 1.0.0 -> 2.0.0
   ```

2. 推送版本标签:
   ```bash
   git push origin v1.0.1
   ```

3. 发布工作流将自动执行并创建GitHub Release

### 开发流程

1. 在 `develop` 分支进行开发
2. 推送代码会自动触发开发工作流
3. 创建Pull Request到 `main` 分支进行发布
4. 合并后可创建版本标签触发发布

### 手动触发

你也可以手动触发工作流:

```bash
# 触发依赖更新
git commit -m "chore: update dependencies [deps]"
git push

# 跳过CI检查
git commit -m "feat: new feature [skip ci]"
git push
```

## 环境变量

工作流使用以下环境变量:

- `GITHUB_TOKEN`: GitHub提供的自动令牌
- `NODE_VERSION`: 使用的Node.js版本

## 输出产物

### 构建产物
- 插件包: `orca-link-icons-plugin-{version}.zip`
- 构建文件: `dist/index.js`
- 验证报告: 构建日志

### Release产物
- GitHub Release页面
- 下载链接
- 更新日志
- 插件信息文件

## 故障排除

### 构建失败
1. 检查TypeScript类型错误
2. 检查ESLint错误
3. 验证依赖版本兼容性
4. 检查文件大小限制

### 发布失败
1. 确认版本标签格式正确 (`v*.*.*`)
2. 检查GitHub Token权限
3. 验证插件结构完整性

### 依赖更新失败
1. 检查依赖兼容性
2. 手动解决冲突
3. 运行 `npm audit fix`

## 最佳实践

### 提交信息
```bash
# 功能提交
git commit -m "feat: add new feature"

# 修复提交
git commit -m "fix: resolve issue description"

# 文档提交
git commit -m "docs: update documentation"

# 样式提交
git commit -m "style: code formatting"

# 重构提交
git commit -m "refactor: code optimization"

# 测试提交
git commit -m "test: add unit tests"

# 跳过CI
git commit -m "chore: update dependencies [skip ci]"
```

### 版本管理
```bash
# 补丁版本 (1.0.0 -> 1.0.1)
npm version patch

# 次版本 (1.0.0 -> 1.1.0)
npm version minor

# 主版本 (1.0.0 -> 2.0.0)
npm version major

# 预发布版本 (1.0.0 -> 1.0.1-alpha.1)
npm version prerelease --preid=alpha
```

### 分支策略
- `main`: 稳定发布分支
- `develop`: 开发分支
- `feature/*`: 功能分支
- `hotfix/*`: 热修复分支

## 监控和通知

工作流状态会通过以下方式通知:

- GitHub Actions界面
- Pull Request状态检查
- Release通知
- 开发报告摘要

## 安全考虑

- 所有工作流使用官方GitHub Actions
- 依赖更新自动进行安全审计
- 代码扫描检查潜在漏洞
- 最小权限原则使用GITHUB_TOKEN