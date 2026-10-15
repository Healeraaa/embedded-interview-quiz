# 嵌入式面试题练习

将嵌入式软件和硬件秋招题库转换为可离线使用、可部署到 GitHub Pages 的单页答题网页。

在线访问：https://healeraaa.github.io/embedded-interview-quiz/

## 本地使用

直接打开 `dist/index.html`。掌握度记录保存在当前浏览器的本地存储中。

## 更新题库

1. 编辑 `content` 目录中的两个 Markdown 文件。
2. 可在本地运行 `node build.mjs` 预览生成结果。
3. 提交并推送到 GitHub 的 `main` 分支。
4. GitHub Actions 会自动执行构建并更新 Pages 网站。

题目使用三级标题，例如：

```markdown
### 1.1 问题内容【★★★★★】

这里填写参考答案。
```

## 第一次启用 GitHub Pages

1. 创建一个新的公开仓库，建议命名为 `embedded-interview-quiz`。
2. 只上传本目录中的内容，不要上传外层“简历”目录。
3. 进入仓库的 `Settings` → `Pages`。
4. 在 `Build and deployment` 的 `Source` 中选择 `GitHub Actions`。
5. 打开 `Actions` 页面，等待 `Build and deploy GitHub Pages` 工作流完成。

之后网站地址通常为：

```text
https://你的用户名.github.io/embedded-interview-quiz/
```

## 功能

- 软件/硬件题库切换
- 章节、星级、掌握状态筛选
- 题目与答案全文搜索
- 点击或空格键显示答案
- 随机题、上一题、下一题
- “不会 / 模糊 / 会”本地记录

注意：学习记录保存在浏览器本地，因此手机和电脑之间不会自动同步。

