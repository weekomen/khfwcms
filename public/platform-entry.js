// Keep existing platform bookmarks working after the homepage becomes the website.
// Website section anchors (#home, #courses, etc.) stay on this origin.
if (['kehoubang.cn', 'www.kehoubang.cn'].includes(window.location.hostname)
    && window.location.hash.startsWith('#/')) {
  window.location.replace('https://khb.kehoubang.cn/' + window.location.search + window.location.hash);
}
