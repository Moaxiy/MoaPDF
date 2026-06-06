# MoaPDF

MoaPDF 是一款本地运行的 PDF 工具，适合在打印、整理和转换 PDF 前快速处理文件。文件处理过程全部在本机完成，不会上传到服务器。

## 界面预览

![页面整理](docs/web-layout.png)

![格式转换](docs/convert-layout.png)

## 下载

- [Gitee 下载 MoaPDF v0.1.7 Windows 安装包](https://gitee.com/MXiang0104/codex-pdf/releases/download/v0.1.7/MoaPDF_0.1.7_x64-setup.exe)
- [GitHub 下载 MoaPDF v0.1.7 Windows 安装包](https://github.com/Moaxiy/MoaPDF/releases/download/v0.1.7/MoaPDF_0.1.7_x64-setup.exe)

## 核心功能

- 可视化整理 PDF 页面
- 在指定页面后插入空白页
- 插入空白页后最终页序实时同步
- 章节正面校正，适合双面打印时让章节首页落在正面
- 删除指定页面
- 拆分 PDF
- 合并多个 PDF
- 图片批量转 PDF
- PDF 转 PNG / JPG
- PDF 转 TXT
- TXT / Markdown 转 PDF
- PDF 压缩

## 本次版本更新

- PDF 压缩新增结果预估展示
- 选择 PDF 和调整压缩设置时，实时显示预计压缩后大小
- 预估区展示原始大小、预计节省和预计压缩比例
- 压缩完成后会切换为真实压缩结果，便于对比压缩效果

## 技术栈

- Tauri
- Vite
- PDF.js
- pdf-lib
- jszip
