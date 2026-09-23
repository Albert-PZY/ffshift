/**
 * 层级令牌。
 *
 * 分散在各处的 z-index 迟早会打架（"我再加个 1"），所以集中在这里。
 * 取值之间留出空档，方便插入新的中间层而不用重排。
 */
export const Z_INDEX = {
  /** 常规内容 */
  BASE: 0,
  /** 下拉、菜单、气泡 */
  DROPDOWN: 40,
  /** 对话框遮罩 */
  MODAL_BACKDROP: 50,
  /** 对话框本体（必须在遮罩之上） */
  MODAL_CONTENT: 51,
  /** 对话框里的下拉（必须盖过对话框本体） */
  DROPDOWN_IN_MODAL: 60,
  /** 全局投放提示这类压住整屏的浮层 */
  OVERLAY: 90,
  /** 提示气泡 */
  TOOLTIP: 100,
} as const;
