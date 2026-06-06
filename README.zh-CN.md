# MoaPDF

MoaPDF 是一款本地运行的 PDF 工具，适合在打印、整理和转换 PDF 前快速处理文件。文件处理过程全部在本机完成，不会上传到服务器。

## 界面预览

![页面整理](docs/web-layout.png)

![格式转换](docs/convert-layout.png)

## 下载

- [Gitee 下载 MoaPDF v0.1.8 Windows 安装包](https://gitee.com/MXiang0104/codex-pdf/releases/download/v0.1.8/MoaPDF_0.1.8_x64-setup.exe)
- [GitHub 下载 MoaPDF v0.1.8 Windows 安装包](https://github.com/Moaxiy/MoaPDF/releases/download/v0.1.8/MoaPDF_0.1.8_x64-setup.exe)

## 核心功能

- 可视化整理 PDF 页面
- 在指定页面后插入空白页
- 插入空白页后最终页序实时同步
- 多选页面并批量删除、恢复、插入空白页
- 调整页面顺序并按最终顺序导出
- 删除指定页面
- 拆分 PDF
- 合并多个 PDF
- 图片批量转 PDF
- PDF 转 PNG / JPG
- PDF 转 TXT
- TXT / Markdown 转 PDF
- PDF 压缩

## 本次版本更新

- 页面整理新增多选批量操作
- 支持页面上移、下移和拖拽调整最终导出顺序
- 新增最近处理文件记录，方便回看本地使用历史
- 压缩完成后结果卡片会突出展示真实压缩效果

## 技术栈

- Tauri
- Vite
- PDF.js
- pdf-lib
- jszip
