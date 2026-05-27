# Codex PDF

Codex PDF 是一个本地运行的 PDF 空白页插入工具，主要用于打印前整理 PDF。它可以在原始 PDF 的指定页面前后插入空白页，同时不修改原页面内容，因此原文件里已有的页码、页眉、页脚和正文排版都会保持不变。

项目提供两个入口：

- Web 可视化工具：选择 PDF 后查看页面缩略图，在对应页面后点击加号插入空白页。
- Python CLI：适合批处理或命令行自动化。

## 功能特点

- 支持在首页前、任意原始页后插入一张或多张空白页。
- 页面位置按原始 PDF 页码计算，不会因为前面插入了空白页而错位。
- 支持 PDF 页面缩略图预览，方便按内容判断插入位置。
- 提供最终页序预览，直观看到下载后的页面顺序。
- PDF 文件在浏览器本地处理，不上传到服务器。
- 空白页尺寸会参考相邻原始页面尺寸。

## 技术栈

- Vite
- PDF.js / `pdfjs-dist`
- `pdf-lib`
- Python / `pypdf`

## Web 可视化工具

安装依赖：

```powershell
npm install
```

启动项目：

```powershell
npm run dev
```

打开本地地址：

```text
http://127.0.0.1:5173
```

使用方式：

1. 点击 `选择 PDF`。
2. 查看页面缩略图，找到需要插入空白页的位置。
3. 在 `首页前` 或 `第 N 页后` 的卡片右侧点击 `+`。
4. 查看 `最终页序预览`。
5. 点击 `下载新 PDF`。

## Python CLI

安装依赖：

```powershell
python -m pip install -r requirements.txt
```

在第 3 页后插入 1 张空白页：

```powershell
python .\pdf_blank_insert.py .\input.pdf .\output.pdf --after 3
```

在第 1 页前插入 1 张空白页：

```powershell
python .\pdf_blank_insert.py .\input.pdf .\output.pdf --after 0
```

在第 5 页后插入 2 张空白页，并在第 10 页后插入 1 张：

```powershell
python .\pdf_blank_insert.py .\input.pdf .\output.pdf --after 5:2 --after 10
```

## 项目脚本

```powershell
npm run dev      # 启动开发服务
npm run build    # 构建前端项目
```

## 适用场景

- 打印双面 PDF 时补空白页。
- 保持原 PDF 页码不变，只改变纸张分页。
- 按内容快速定位需要插入空白页的位置。
