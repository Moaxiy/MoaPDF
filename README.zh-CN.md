# MoaPDF

MoaPDF 是一款本地运行的 PDF 工具，适合在打印、整理和转换 PDF 前快速处理文件。文件处理过程全部在本机完成，不会上传到服务器。

## 界面预览

![页面整理](docs/web-layout.png)

![格式转换](docs/convert-layout.png)

## 下载

- [Gitee 下载 MoaPDF v0.1.13 Windows 安装程序](https://gitee.com/MXiang0104/codex-pdf/releases/download/v0.1.13/MoaPDF_0.1.13_x64-setup.exe)
- [GitHub 下载 MoaPDF v0.1.13 Windows 安装程序](https://github.com/Moaxiy/MoaPDF/releases/download/v0.1.13/MoaPDF_0.1.13_x64-setup.exe)

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

- 桌面端安装版启动时不再弹出命令行窗口
- 关闭窗口后自动隐藏到系统托盘，保持后台运行
- 托盘菜单新增显示、隐藏到后台和退出操作
- 根目录快捷启动脚本优先打开已安装版本，并隐藏开发启动窗口

## 技术栈

- Tauri
- Vite
- PDF.js
- pdf-lib
- jszip
