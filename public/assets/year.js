// The year in the footer. A file of its own so the Content Security Policy can forbid inline scripts.
const yr = document.getElementById('yr');
if (yr) yr.textContent = new Date().getFullYear();
