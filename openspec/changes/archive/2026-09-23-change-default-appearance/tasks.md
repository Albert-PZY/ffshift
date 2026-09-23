## 1. 默认值

- [x] `FONT_SIZE_DEFAULT` 14 → 15
- [x] `DEFAULT_SETTINGS.theme` light → dim
- [x] argv 解析的兜底与上面两个一致（有单测钉住）

## 2. 测试与文档

- [x] 单测里对默认值的断言同步
- [x] 端到端里对默认值的断言同步
- [x] 文档（design-system / ui-spec / README）同步

## 3. 验证

- [x] `npm run typecheck`
- [x] `npm run test:unit`
- [x] `npm run build`
- [x] 三套主题各截一张图，确认默认那一套真的生效
- [x] 端到端套件本轮按需求方要求未执行；对默认值的断言已更新，下次跑套件时一并验证

