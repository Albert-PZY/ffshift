/**
 * 渲染进程能读到的构建期变量。
 *
 * 只声明用得到的那几个：引入 vite/client 的全量类型会把 `import.meta.env` 变成
 * 一个带索引签名的对象，写错名字（VITE_APP_VERSOIN）也不会报错。
 */
interface ImportMetaEnv {
  /** 构建时从 package.json 注入，见 electron.vite.config.ts 的 define */
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
