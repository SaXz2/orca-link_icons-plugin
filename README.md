# Orca Link Icons Plugin

自动更新链接图标插件 - 为Orca Note中的链接自动获取并显示网站图标

## 功能特性

- 🚀 **自动检测**: 实时检测页面中的新链接
- 🎯 **智能获取**: 从多个图标源自动获取网站图标
- 💾 **缓存系统**: 本地缓存图标，提高加载速度
- 🔄 **批量处理**: 分批处理大量链接，避免性能问题
- 🛡️ **错误处理**: 完善的错误处理和降级机制
- 🎨 **美观显示**: 平滑的加载动画和过渡效果

## 安装方法

1. 将此插件文件夹复制到 `orca/plugins/` 目录下
2. 重启Orca Note应用
3. 在插件管理器中启用此插件

## 使用方法

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

- **多图标源**: 支持Google、DuckDuckGo、Yandex等多个图标源
- **智能降级**: 当图标获取失败时自动使用备用图标
- **内存管理**: 完善的资源清理机制，防止内存泄漏
- **性能优化**: 防抖处理、批量加载、超时控制等优化措施

## 配置参数

插件内置以下配置参数：

- `CACHE_KEY`: 缓存键名
- `MAX_CACHE_SIZE`: 最大缓存数量 (500)
- `BATCH_SIZE`: 批量处理大小 (15)
- `LOAD_TIMEOUT`: 加载超时时间 (3000ms)
- `RETRY_COUNT`: 重试次数 (3)
- `DEBOUNCE_DELAY`: 防抖延迟 (500ms)

## 兼容性

- Orca Note 最新版本
- 现代浏览器 (支持ES6+)
- 支持HTTPS和HTTP链接

## 许可证

MIT License 