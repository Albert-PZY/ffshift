/**
 * 签名 / 验签：可选步骤，按环境变量走。
 *
 *   FFSHIFT_SIGN_PFX    证书路径（.pfx）
 *   FFSHIFT_SIGN_PASS   证书密码
 *   --verify            改为验签已打包的 exe
 *
 * 没配证书时打印说明退出，不报错——没有证书也能打安装包，
 * 只是 Windows 会弹 SmartScreen。要消除提示需要一张代码签名证书。
 *
 *   node scripts/sign-release.mjs          # 对 release/*.exe 做 Authenticode 签名
 *   node scripts/sign-release.mjs --verify # 只验签，不签
 */
import { existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RELEASE = 'release';
const VERIFY_ONLY = process.argv.includes('--verify');
const PFX = process.env.FFSHIFT_SIGN_PFX ?? '';
const PASS = process.env.FFSHIFT_SIGN_PASS ?? '';

// signtool 来自 Windows SDK；常见安装位置按顺序找
const SIGNTOOL_PATHS = [
  process.env.FFSHIFT_SIGNTOOL,
  'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe',
  'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.22621.0\\x64\\signtool.exe',
  'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe',
].filter(Boolean);

const signtool = SIGNTOOL_PATHS.find((p) => existsSync(p));

if (!signtool) {
  console.error('未找到 signtool.exe。');
  console.error('请安装 Windows SDK（或设置 FFSHIFT_SIGNTOOL 指向 signtool.exe）。');
  process.exit(1);
}

if (!existsSync(RELEASE)) {
  console.error(`release/ 目录不存在，先跑 npm run package。`);
  process.exit(1);
}

const exes = readdirSync(RELEASE).filter((f) => f.endsWith('.exe'));
if (exes.length === 0) {
  console.error('release/ 里没有 exe。');
  process.exit(1);
}

if (VERIFY_ONLY) {
  for (const f of exes) {
    const p = join(RELEASE, f);
    try {
      execFileSync(signtool, ['verify', '/pa', '/all', p], { stdio: 'inherit' });
      console.log(`✔ ${f} 签名有效`);
    } catch {
      console.error(`✘ ${f} 无有效签名`);
    }
  }
  process.exit(0);
}

if (!PFX || !PASS) {
  console.log('未配置签名证书（可选步骤）。');
  console.log('');
  console.log('要签名请设置环境变量后重跑：');
  console.log('  FFSHIFT_SIGN_PFX   证书路径（.pfx）');
  console.log('  FFSHIFT_SIGN_PASS  证书密码');
  console.log('');
  console.log('没有证书也能打安装包，只是 Windows 会弹 SmartScreen 提示。');
  console.log('个人开发者可用自签证书 + 用户手动信任，或选择不签名直接分发。');
  process.exit(0);
}

for (const f of exes) {
  const p = join(RELEASE, f);
  console.log(`签名 ${f} …`);
  execFileSync(
    signtool,
    ['sign', '/f', PFX, '/p', PASS, '/fd', 'SHA256', '/tr', 'http://timestamp.digicert.com', '/td', 'SHA256', p],
    { stdio: 'inherit' },
  );
}
console.log('签名完成，验签：');
execFileSync(signtool, ['verify', '/pa', '/all', ...exes.map((f) => join(RELEASE, f))], { stdio: 'inherit' });
