(() => {
    'use strict';

    // The exported readers are hosted separately from the CMS. Keep this control
    // in the top-level reader only, even if a viewer also loads HTML in frames.
    if (window.top !== window.self || !/^\/profile\/upload\/pdf\/[123](?:\/|$)/.test(window.location.pathname)) return;

    function addReturnLink() {
        if (document.getElementById('khb-return-home')) return;

        if (!document.getElementById('khb-document-return-style')) {
            const stylesheet = document.createElement('link');
            stylesheet.id = 'khb-document-return-style';
            stylesheet.rel = 'stylesheet';
            stylesheet.href = new URL('/document-return.css', window.location.origin).href;
            document.head.append(stylesheet);
        }

        const link = document.createElement('a');
        link.id = 'khb-return-home';
        link.href = 'https://kehoubang.cn/';
        link.target = '_self';
        link.textContent = '← 返回官网';
        document.body.append(link);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addReturnLink, { once: true });
    } else {
        addReturnLink();
    }
})();
