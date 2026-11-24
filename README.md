# 儿童学习乐园（kid.u32.cn）

面向儿童的学习 Web 应用集合：以练代学 / 单词拼写 / 单词测试 / 音标学习 / 诗词背诵 / 语文词语表 / 学习计时 / 题库练习。全部纯静态、免登录、离线可用（PWA）。

**在线访问：https://kid.u32.cn**

## 应用清单

| 应用 | 路径 | 说明 |
|---|---|---|
| 导航首页 | `/` | 聚合入口 |
| 以练代学 | `/learn-by-doing/` | 通用练习应用 |
| 单词以练代学 | `/words-learn-by-doing/` | 单词拼写练习 PWA（间隔复习） |
| 单词测试 | `/words-test/` | 随机抽样测试单词掌握度 |
| 音标学习 | `/yinbiao/` | 英语 48 音标点击发音 |
| 练习场 | `/practice-zone/` | 通用题集练习 PWA（粘贴 JSON 即练） |
| 时间管理 | `/time-tracker/` | 学习时长统计 |
| 诗词背诵 | `/poetry-recite/` | 古诗词阅读与背诵 PWA |
| 词语表 | `/words-list/` | 小学语文课本词语表 PWA（含笔顺动画） |
| 题库 | `/question-bank/` | KET / 新概念英语 / 数学题库（数据经 `kid.u32.cn/data/` 加载） |

## 开发

本仓库为 `u32-kid-2026` 私有主仓的 `homepage/` 子树（`git subtree push --prefix homepage`）。站点经 GitHub Actions 部署到 Pages，EdgeOne 回源分发到 `kid.u32.cn`。

题库大数据（ket/nce/math，约 165M）不入仓库，存放于阿里云 OSS `u32-cn-data/_inner_/bigdata/kid/question-bank/`。

## License

[MIT](LICENSE)
