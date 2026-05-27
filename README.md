# MoaPDF

MoaPDF 是一个本地运行的 PDF 工具，适合打印前整理、页面调整、格式转换和 PDF 压缩。所有处理都在本机完成，文件不会上传到服务器。

## 界面预览

### 页面整理

![MoaPDF 页面整理界面](docs/web-layout.png)

### 格式转换

![MoaPDF 格式转换界面](docs/convert-layout.png)

## 当前版本

- 桌面端已切换为 Tauri 打包，安装包更轻。
- Windows 安装包输出位置：
  `src-tauri/target/release/bundle/nsis/MoaPDF_0.1.0_x64-setup.exe`

## 功能概览

- 可视化预览 PDF 页面缩略图。
- 按原始页码在首页前或任意页后插入空白页。
- 删除指定页面。
- 按页码范围拆分 PDF。
- 按顺序合并多个 PDF。
- 图片转 PDF。
- PDF 转 PNG ZIP。
- PDF 转 JPG ZIP，并支持质量调节。
- PDF 转 TXT。
- TXT / Markdown 转 PDF。
- PDF 压缩，支持无损优化、均衡压缩、强力压缩和极限压缩。
- 提供最终页序预览，方便下载前确认结果。

## 安装与使用

1. 下载并运行 Windows 安装包：
   `MoaPDF_0.1.0_x64-setup.exe`
2. 按安装向导完成安装。
3. 启动 MoaPDF，导入 PDF 后直接在界面中操作。

## 主要操作

### 插入空白页

1. 打开一个 PDF。
2. 在页面列表中找到 `首页前` 或 `第 N 页后`。
3. 点击 `+` 添加空白页。
4. 在右侧查看最终页序。
5. 下载处理后的 PDF。

### 删除页面

1. 打开一个 PDF。
2. 在页面卡片上点击 `删除页面`。
3. 下载处理后的 PDF。

### 拆分 PDF

1. 打开一个 PDF。
2. 在拆分区域输入范围，例如：

```text
1-3, 6, 9-12
```

3. 下载拆分结果。

### 合并 PDF

1. 在合并区域选择多个 PDF。
2. 通过 `上移`、`下移`、`移除` 调整顺序。
3. 下载合并后的 PDF。

### 格式转换与压缩

- 图片转 PDF：支持 PNG、JPG、WebP。
- PDF 转 PNG：每页导出为 PNG 并打包为 ZIP。
- PDF 转 JPG：每页导出为 JPG 并打包为 ZIP。
- PDF 转 TXT：提取可复制文本。
- TXT / Markdown 转 PDF：导入文本文件后导出 PDF。
- PDF 压缩：支持质量、缩放和灰度压缩参数。

## 技术栈

- Tauri
- Vite
- PDF.js / `pdfjs-dist`
- `pdf-lib`
- `jszip`
