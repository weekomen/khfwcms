import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function tunnelEnvironment(address, environment = process.env) {
    let url;
    try { url = new URL(address); } catch { throw new Error('请提供完整的 HTTPS 穿透地址，例如 https://your-tunnel.example.com'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['/', '/admin', '/admin/'].includes(url.pathname)) {
        throw new Error('穿透地址必须使用 HTTPS，只填写站点地址或 /admin，不要包含账号、参数或其他路径');
    }
    return { ...environment, HOST: '127.0.0.1', PUBLIC_ORIGIN: url.origin, TRUST_PROXY: 'loopback' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        if (process.argv.length !== 3) throw new Error('用法：npm run start:tunnel -- https://你的公网域名');
        const environment = tunnelEnvironment(process.argv[2]);
        // Keep the existing PORT, DATA_DIR and credentials; only configure access.
        process.env.HOST = environment.HOST;
        process.env.PUBLIC_ORIGIN = environment.PUBLIC_ORIGIN;
        process.env.TRUST_PROXY = environment.TRUST_PROXY;
        console.log(`穿透后台地址：${environment.PUBLIC_ORIGIN}/admin`);
        console.log('隧道须保留公网 Host 和 HTTPS 协议头；公网域名变更后请用新地址重新启动。');
        await import('../server.mjs');
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
