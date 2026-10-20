const $ = id => document.getElementById(id);
const api = '/api/kbooks-admin';
let books = [];
let busy = false;
let listing = false;
const size = n => n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const date = n => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(n));
function message(text, error = false) {
  $('message').textContent = text;
  $('message').classList.toggle('error', error);
  $('message').hidden = false;
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error(data.error || '登录已失效或无访问权限，请刷新页面重新登录。');
    throw new Error(data.error || (typeof data === 'string' && data.length < 250 ? data : `操作失败（${response.status}），请稍后重试。`));
  }
  if (!type.includes('application/json') && response.status === 200 && /^\s*</.test(data)) throw new Error('登录已失效，请刷新页面重新登录。');
  return data;
}
function render() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const filtered = books.filter(b => b.title.toLocaleLowerCase().includes(query));
  $('bookCount').textContent = `${books.length} 本`;
  $('storageSummary').textContent = `共 ${size(books.reduce((n, b) => n + b.size, 0))} · 已上传的书会加入 Kindle 下载书单`;
  $('books').replaceChildren();
  if (!filtered.length) {
    const p = document.createElement('p'); p.className = 'empty';
    p.textContent = query ? '没有找到这本书，换个关键词试试。' : '书库还是空的。上传第一本书，开始阅读。';
    $('books').append(p);
  }
  for (const book of filtered) {
    const row = document.createElement('article'); row.className = 'book-row';
    const info = document.createElement('div'); info.className = 'book-info';
    const title = document.createElement('div'); title.className = 'book-title'; title.textContent = book.title;
    const meta = document.createElement('div'); meta.className = 'book-meta';
    for (const text of [size(book.size), date(book.created_at)]) { const span = document.createElement('span'); span.textContent = text; meta.append(span); }
    const state = document.createElement('span'); state.className = 'book-state'; state.textContent = book.received_count ? `已被 ${book.received_count} 台设备下载` : '等待 Kindle 下载'; meta.append(state);
    info.append(title, meta);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'delete-button'; button.textContent = '删除'; button.disabled = busy;
    button.setAttribute('aria-label', `删除 ${book.title}`); button.addEventListener('click', () => confirmDelete(book));
    row.append(info, button); $('books').append(row);
  }
}
function setBusy(value) {
  busy = value;
  for (const id of ['uploadButton', 'bookFile', 'bookTitle', 'refreshButton']) $(id).disabled = value;
  render();
}
async function load() {
  if (listing) return;
  listing = true; $('refreshButton').disabled = true;
  try {
    const data = await request(api);
    if (!Array.isArray(data.books)) throw new Error('书单返回异常，请刷新后重试。');
    books = data.books; render();
  } finally { listing = false; $('refreshButton').disabled = busy; }
}
function selectFile() {
  const file = $('bookFile').files[0];
  $('fileName').textContent = file ? `${file.name} · ${size(file.size)}` : '选择 AZW3 文件';
  if (file) $('bookTitle').value = file.name.replace(/\.azw3$/i, '').replace(/^(?:Kclip-)+/i, '').replace(/ \[[a-f0-9]{8}\]$/i, '').slice(0, 234);
}
$('bookFile').addEventListener('change', selectFile);
$('search').addEventListener('input', render);
$('refreshButton').addEventListener('click', () => load().then(() => message('书单已刷新。')).catch(e => message(e.message, true)));
for (const event of ['dragenter', 'dragover']) $('dropZone').addEventListener(event, e => { e.preventDefault(); if (!busy) $('dropZone').classList.add('dragging'); });
for (const event of ['dragleave', 'drop']) $('dropZone').addEventListener(event, e => { e.preventDefault(); $('dropZone').classList.remove('dragging'); });
$('dropZone').addEventListener('drop', e => {
  if (busy || !e.dataTransfer.files.length) return;
  if (e.dataTransfer.files.length !== 1) return message('请一次上传一本书。', true);
  $('bookFile').files = e.dataTransfer.files; selectFile();
});
$('uploadForm').addEventListener('submit', async e => {
  e.preventDefault(); if (busy) return;
  const file = $('bookFile').files[0]; const title = $('bookTitle').value.trim();
  if (!file || !/\.azw3$/i.test(file.name)) return message('请选择 AZW3 文件。', true);
  if (file.size > 20 * 1024 * 1024 || file.size < 78) return message('请选择有效的 AZW3，文件不能超过 20 MB。', true);
  if (!title) return message('请填写书单标题。', true);
  setBusy(true); $('uploadButton').textContent = '正在上传…'; message('正在上传，请保持页面打开。');
  try {
    const result = await request(`${api}?op=upload&title=${encodeURIComponent(title)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
    $('uploadForm').reset(); selectFile();
    message(`《${result.title}》已存入书库。请在 Kindle 上选择“2. 下载 R2 书籍”。相同文件不会重复加入或重复下载。`);
    try { await load(); } catch { message('书籍已上传，但书单刷新失败，请点击刷新。', true); }
  } catch (e) { message(`上传未完成：${e.message} 可以重试，相同文件不会重复入库。`, true); }
  finally { setBusy(false); $('uploadButton').textContent = '上传到书库 ↑'; }
});
async function confirmDelete(book) {
  if (busy) return;
  const dialog = $('deleteDialog'); $('deleteTitle').textContent = book.title;
  dialog.returnValue = ''; dialog.showModal();
  const choice = await new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
  if (choice !== 'delete') return;
  setBusy(true); message('正在删除…');
  try {
    await request(`${api}?op=delete&id=${encodeURIComponent(book.id)}`, { method: 'DELETE' });
    books = books.filter(b => b.id !== book.id); render(); message(`已从云端书库删除《${book.title}》。`);
  } catch (e) { message(`删除未完成：${e.message}`, true); }
  finally { setBusy(false); }
}
load().catch(e => { $('books').textContent = '暂时无法读取书单。'; $('storageSummary').textContent = '连接失败'; message(e.message, true); });
