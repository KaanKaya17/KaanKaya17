import { readFile, writeFile } from 'node:fs/promises';

const owner = process.env.GITHUB_REPOSITORY_OWNER || 'KaanKaya17';
const start = '<!-- public-repos:start -->';
const end = '<!-- public-repos:end -->';
const repositories = [];
const headers = { Accept: 'application/vnd.github+json' };
if (process.env.GH_TOKEN) headers.Authorization = 'Bearer ' + process.env.GH_TOKEN;

for (let page = 1; ; page += 1) {
  const url = new URL('https://api.github.com/users/' + encodeURIComponent(owner) + '/repos');
  url.search = new URLSearchParams({ type: 'owner', sort: 'full_name', direction: 'asc', per_page: '100', page: String(page) });
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error('GitHub repositories request failed: ' + response.status);
  const batch = await response.json();
  if (!Array.isArray(batch)) throw new Error('Unexpected GitHub repository data');
  repositories.push(...batch);
  if (batch.length < 100) break;
}

function escapeMarkdown(text) {
  return text.replace(/[\r\n]+/g, ' ').replace(/[\\\x60*_{}\[\]<>()#!|~]/g, '\\$&');
}

const rows = repositories
  .filter(repo => repo.private === false && repo.name.toLowerCase() !== owner.toLowerCase())
  .map(repo => {
    const description = repo.description ? ' — ' + escapeMarkdown(repo.description.trim()) : '';
    return '- [' + escapeMarkdown(repo.name) + '](' + repo.html_url + ')' + description;
  });
if (rows.length === 0) rows.push('No public project repositories yet.');

const path = new URL('../../README.md', import.meta.url);
const readme = await readFile(path, 'utf8');
const first = readme.indexOf(start);
const last = readme.indexOf(end);
if (first < 0 || last <= first || readme.lastIndexOf(start) !== first || readme.lastIndexOf(end) !== last) {
  throw new Error('Expected one public repository section in README.md');
}
const updated = readme.slice(0, first + start.length) + '\n' + rows.join('\n') + '\n' + readme.slice(last);
if (updated !== readme) await writeFile(path, updated);
