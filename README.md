# Orca Link Icons Plugin

自动更新链接图标插件 - 为 Orca Note 中的链接自动获取并显示网站图标

## 功能特性

- 🚀 **自动检测**: 实时检测页面中的新链接
- 🎯 **智能获取**: 从多个图标源自动获取网站图标
- 💾 **缓存系统**: 本地缓存图标，提高加载速度
- 🔄 **批量处理**: 分批处理大量链接，避免性能问题
- 🛡️ **错误处理**: 完善的错误处理和降级机制
- 🎨 **美观显示**: 平滑的加载动画和过渡效果

## 快速开始

### 安装

1. 将此插件文件夹复制到 `orca/plugins/` 目录下
2. 重启 Orca Note 应用
3. 在插件管理器中启用此插件

### 使用

插件启用后会自动工作，无需额外配置：

1. 在笔记中添加链接
2. 插件会自动检测并替换默认的链接图标
3. 图标会从网站自动获取并缓存

## 控制台命令

插件在全局对象 `window.__ORCA_ICON_REPLACER` 中提供了以下控制命令：

```javascript
// 重启插件
__ORCA_ICON_REPLACER.restart()

// 停止插件
__ORCA_ICON_REPLACER.stop()

// 清除缓存
__ORCA_ICON_REPLACER.clearCache()

// 获取统计信息
__ORCA_ICON_REPLACER.getStats()

// 检查内存使用情况
__ORCA_ICON_REPLACER.inspectMemory()
```

## 技术特性

- **多图标源**: 支持 Google、DuckDuckGo、Yandex 等多个图标源
- **智能降级**: 当图标获取失败时自动使用备用图标
- **内存管理**: 完善的资源清理机制，防止内存泄漏
- **性能优化**: 防抖处理、批量加载、超时控制等优化措施

## 配置参数

插件内置以下配置参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `CACHE_KEY` | `orca-icon-cache-v3` | 缓存键名 |
| `MAX_CACHE_SIZE` | 500 | 最大缓存数量 |
| `BATCH_SIZE` | 15 | 批量处理大小 |
| `LOAD_TIMEOUT` | 3000ms | 加载超时时间 |
| `RETRY_COUNT` | 3 | 重试次数 |
| `DEBOUNCE_DELAY` | 500ms | 防抖延迟 |

## 兼容性

- Orca Note 最新版本
- 现代浏览器 (支持 ES6+)
- 支持 HTTPS 和 HTTP 链接

## 开发

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 类型检查

```bash
npm run type-check
```

### 验证插件结构

```bash
npm run validate-plugin-structure
```

## 作者

**iwy5nfalj9l1y**

- GitHub: [SaXz2/orca-link-icons-plugin](https://github.com/SaXz2/orca-link-icons-plugin)

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件 