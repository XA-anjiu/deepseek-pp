/**
 * 独立的悬浮聊天 content script
 * 在所有网页上注入悬浮聊天按钮和窗口
 */
import { startChatLauncher } from './content/adapters/chat-launcher';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    startChatLauncher();
  },
});