# MoaPDF

MoaPDF 是一款本地运行的 PDF 工具，适合在打印、整理和转换 PDF 前快速处理文件。文件处理过程全部在本机完成，不会上传到服务器。

## 界面预览

![页面整理](docs/web-layout.png)

![格式转换](docs/convert-layout.png)

## 下载

- [Gitee 下载 MoaPDF v0.1.11 Windows 安装程序](https://gitee.com/MXiang0104/codex-pdf/releases/download/v0.1.11/MoaPDF_0.1.11_x64-setup.exe)
- [GitHub 下载 MoaPDF v0.1.11 Windows 安装程序](https://github.com/Moaxiy/MoaPDF/releases/download/v0.1.11/MoaPDF_0.1.11_x64-setup.exe)

## 核心功能

- 可视化整理 PDF 页面
- 在指定页面后插入空白页
- 插入空白页后最终页序实时同步
- 多选页面并批量删除、恢复、插入空白页
- 调整页面顺序并按最终顺序导出
- 删除指定页面
- 拆分 PDF
- 合并多个 PDF
- 图片批量转 PDF，支持追加选择、拖拽排序、缩略图预览、页面尺寸和边距设置
- PDF 转 PNG / JPG，支持页码范围
- PDF 转 TXT
- TXT / Markdown 转 PDF
- PDF 压缩

## 本次版本更新

- 图片转 PDF 支持拖拽上传和追加选择，不再覆盖已排序图片
- 图片转 PDF 新增缩略图排序、清空图片、页面尺寸和边距设置
- PDF 转 PNG 新增页码范围导出
- 照片尺寸与背景新增智能换底色，预览和下载结果保持一致
- 照片换底支持原背景色手动指定、自动取样和点击预览取样
- 优化构建分包，降低主入口脚本体积

## 技术栈

- Tauri
- Vite
- PDF.js
- pdf-lib
- jszip
