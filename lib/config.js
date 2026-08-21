// 前端配置。AUTH_MODE 决定走共享密码还是账号 + 激活码。
export const AUTH_MODE = 'remote'; // 'remote' | 'password'
export const API_BASE = 'https://indo-learn-api.barnabas7223.workers.dev';
// 卖码模式下用户拿不到明文激活码，页面上要留一个能直接联系到的方式；
// 以后要换负责人邮箱只改这一处。
export const ADMIN_CONTACT = 'barnabas7223@gmail.com';
