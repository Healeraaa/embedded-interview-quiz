# 嵌入式面试题练习

将嵌入式软件和硬件秋招题库转换为可离线使用、可部署到 GitHub Pages 的单页答题网页。

在线访问：https://healeraaa.github.io/embedded-interview-quiz/

## 本地使用

直接打开 `dist/index.html`。未登录时学习记录保存在当前浏览器；登录后会同步到 Supabase。

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
- 7、14、21、30 天学习计划；按章节题量比例分层抽题，并以固定随机顺序混合章节
- 间隔复习：“不会”下一天重现，“模糊”3 天后重现，“会”则移出复习队列
- 章节、星级、掌握状态筛选
- 题目与答案全文搜索
- 点击或空格键显示答案
- 随机题、上一题、下一题
- 邮箱注册和登录
- “不会 / 模糊 / 会”、复习计划及个人笔记跨设备同步
- 断网或未登录时继续使用浏览器本地记录

Supabase 数据表与 RLS 权限定义保存在 `supabase/schema.sql`。前端仅使用可公开的 Project URL 和 Publishable key；不要将数据库密码或 Secret key 提交到仓库。

