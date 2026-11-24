// Turns a prepared request ({ method, url, headers, body, formData }) into a code snippet
// for the language the user picks in the Code panel.

const dq = (s) => JSON.stringify(String(s)); // "double quoted", escapes " \ and newlines
const sq = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`; // 'single quoted' (no interpolation of $ or #{})
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`; // POSIX shell
const psq = (s) => `'${String(s).replace(/'/g, "''")}'`; // PowerShell
const pad = (text, n) => text.split('\n').map((l, i) => (i ? ' '.repeat(n) + l : l)).join('\n');

// Normalizes the request so each generator only deals with one shape
function normalize(req) {
  const form = (req.formData || []).map((f) => (f.type === 'file' ? { key: f.key, file: f.filename || 'file' } : { key: f.key, value: f.value }));
  const headers = { ...req.headers };
  return { method: req.method, url: req.url || 'https://example.com', headers, body: form.length ? undefined : req.body || undefined, form };
}
const headerEntries = (r) => Object.entries(r.headers);

const generators = {
  curl: (r) => {
    const parts = [`curl --location --request ${r.method} ${shq(r.url)}`];
    headerEntries(r).forEach(([k, v]) => parts.push(`--header ${shq(`${k}: ${v}`)}`));
    r.form.forEach((f) => parts.push(`--form ${shq(f.file ? `${f.key}=@${f.file}` : `${f.key}=${f.value}`)}`));
    if (r.body !== undefined) parts.push(`--data-raw ${shq(r.body)}`);
    return parts.join(' \\\n  ');
  },

  http: (r) => {
    let host = r.url;
    let path = '/';
    try {
      const u = new URL(r.url);
      host = u.host;
      path = u.pathname + u.search;
    } catch { /* keep raw */ }
    const lines = [`${r.method} ${path} HTTP/1.1`, `Host: ${host}`, ...headerEntries(r).map(([k, v]) => `${k}: ${v}`)];
    if (r.form.length) lines.push('Content-Type: multipart/form-data', '', ...r.form.map((f) => `${f.key}: ${f.file ? `<file ${f.file}>` : f.value}`));
    else if (r.body !== undefined) lines.push('', r.body);
    return lines.join('\n');
  },

  jsFetch: (r) => {
    const opts = [`  method: ${dq(r.method)}`];
    if (headerEntries(r).length) opts.push(`  headers: ${pad(JSON.stringify(r.headers, null, 2), 2)}`);
    let pre = '';
    if (r.form.length) {
      pre = 'const formData = new FormData();\n' + r.form.map((f) => (f.file ? `formData.append(${dq(f.key)}, fileInput.files[0], ${dq(f.file)});` : `formData.append(${dq(f.key)}, ${dq(f.value)});`)).join('\n') + '\n\n';
      opts.push('  body: formData');
    } else if (r.body !== undefined) opts.push(`  body: ${dq(r.body)}`);
    return `${pre}fetch(${dq(r.url)}, {\n${opts.join(',\n')}\n})\n  .then((response) => response.text())\n  .then((result) => console.log(result))\n  .catch((error) => console.error(error));`;
  },

  jsAxios: (r) => {
    const cfg = [`  method: ${dq(r.method.toLowerCase())}`, `  url: ${dq(r.url)}`];
    if (headerEntries(r).length) cfg.push(`  headers: ${pad(JSON.stringify(r.headers, null, 2), 2)}`);
    let pre = "const axios = require('axios');\n";
    if (r.form.length) {
      pre += "const FormData = require('form-data');\nconst fs = require('fs');\nconst data = new FormData();\n" + r.form.map((f) => (f.file ? `data.append(${dq(f.key)}, fs.createReadStream(${dq(f.file)}));` : `data.append(${dq(f.key)}, ${dq(f.value)});`)).join('\n') + '\n';
      cfg.push('  data');
    } else if (r.body !== undefined) cfg.push(`  data: ${dq(r.body)}`);
    return `${pre}\naxios(${'{'}\n${cfg.join(',\n')}\n})\n  .then((response) => console.log(response.data))\n  .catch((error) => console.error(error));`;
  },

  python: (r) => {
    const lines = ['import requests', '', `url = ${dq(r.url)}`];
    if (headerEntries(r).length) lines.push(`headers = ${pad(JSON.stringify(r.headers, null, 4), 0)}`);
    const args = [dq(r.method), 'url'];
    if (headerEntries(r).length) args.push('headers=headers');
    if (r.form.length) {
      lines.push(`data = ${JSON.stringify(Object.fromEntries(r.form.filter((f) => !f.file).map((f) => [f.key, f.value])))}`);
      lines.push(`files = [${r.form.filter((f) => f.file).map((f) => `(${dq(f.key)}, open(${dq(f.file)}, 'rb'))`).join(', ')}]`);
      args.push('data=data', 'files=files');
    } else if (r.body !== undefined) {
      lines.push(`payload = ${dq(r.body)}`);
      args.push('data=payload');
    }
    lines.push('', `response = requests.request(${args.join(', ')})`, 'print(response.text)');
    return lines.join('\n');
  },

  go: (r) => {
    const body = r.body !== undefined ? `strings.NewReader(${dq(r.body)})` : 'nil';
    const lines = [
      'package main', '', 'import (', '  "fmt"', '  "io"', '  "net/http"', ...(r.body !== undefined ? ['  "strings"'] : []), ')', '',
      'func main() {', `  url := ${dq(r.url)}`, `  method := ${dq(r.method)}`, '',
      `  req, err := http.NewRequest(method, url, ${body})`, '  if err != nil {', '    fmt.Println(err)', '    return', '  }',
      ...headerEntries(r).map(([k, v]) => `  req.Header.Add(${dq(k)}, ${dq(v)})`),
      '', '  client := &http.Client{}', '  res, err := client.Do(req)', '  if err != nil {', '    fmt.Println(err)', '    return', '  }',
      '  defer res.Body.Close()', '', '  out, err := io.ReadAll(res.Body)', '  if err != nil {', '    fmt.Println(err)', '    return', '  }', '  fmt.Println(string(out))', '}',
    ];
    if (r.form.length) lines.splice(1, 0, '// Note: multipart form-data needs mime/multipart; build the body with multipart.NewWriter.');
    return lines.join('\n');
  },

  javaOkHttp: (r) => {
    const lines = ['OkHttpClient client = new OkHttpClient().newBuilder().build();'];
    let bodyExpr = 'null';
    if (r.form.length) {
      lines.push('RequestBody body = new MultipartBody.Builder().setType(MultipartBody.FORM)');
      r.form.forEach((f) => lines.push(f.file ? `  .addFormDataPart(${dq(f.key)}, ${dq(f.file)}, RequestBody.create(MediaType.parse("application/octet-stream"), new File(${dq(f.file)})))` : `  .addFormDataPart(${dq(f.key)}, ${dq(f.value)})`));
      lines.push('  .build();');
      bodyExpr = 'body';
    } else if (r.body !== undefined) {
      const ct = Object.entries(r.headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] || 'text/plain';
      lines.push(`MediaType mediaType = MediaType.parse(${dq(ct)});`, `RequestBody body = RequestBody.create(mediaType, ${dq(r.body)});`);
      bodyExpr = 'body';
    } else if (!['GET', 'HEAD'].includes(r.method)) bodyExpr = 'RequestBody.create(null, new byte[0])';
    lines.push('Request request = new Request.Builder()', `  .url(${dq(r.url)})`, `  .method(${dq(r.method)}, ${['GET', 'HEAD'].includes(r.method) ? 'null' : bodyExpr})`);
    headerEntries(r).forEach(([k, v]) => lines.push(`  .addHeader(${dq(k)}, ${dq(v)})`));
    lines.push('  .build();', 'Response response = client.newCall(request).execute();', 'System.out.println(response.body().string());');
    return lines.join('\n');
  },

  csharp: (r) => {
    const lines = ['var client = new HttpClient();', `var request = new HttpRequestMessage(new HttpMethod(${dq(r.method)}), ${dq(r.url)});`];
    const contentHeaders = [];
    headerEntries(r).forEach(([k, v]) => {
      if (k.toLowerCase().startsWith('content-')) contentHeaders.push([k, v]);
      else lines.push(`request.Headers.TryAddWithoutValidation(${dq(k)}, ${dq(v)});`);
    });
    if (r.form.length) {
      lines.push('var content = new MultipartFormDataContent();');
      r.form.forEach((f) => lines.push(f.file ? `content.Add(new StreamContent(File.OpenRead(${dq(f.file)})), ${dq(f.key)}, ${dq(f.file)});` : `content.Add(new StringContent(${dq(f.value)}), ${dq(f.key)});`));
      lines.push('request.Content = content;');
    } else if (r.body !== undefined) {
      const ct = contentHeaders.find(([k]) => k.toLowerCase() === 'content-type')?.[1] || 'text/plain';
      lines.push(`request.Content = new StringContent(${dq(r.body)}, null, ${dq(ct)});`);
    }
    lines.push('var response = await client.SendAsync(request);', 'response.EnsureSuccessStatusCode();', 'Console.WriteLine(await response.Content.ReadAsStringAsync());');
    return lines.join('\n');
  },

  php: (r) => {
    const lines = ['<?php', '$curl = curl_init();', '', 'curl_setopt_array($curl, array(', `  CURLOPT_URL => ${sq(r.url)},`, '  CURLOPT_RETURNTRANSFER => true,', `  CURLOPT_CUSTOMREQUEST => ${sq(r.method)},`];
    if (r.form.length) lines.push(`  CURLOPT_POSTFIELDS => array(${r.form.map((f) => `${sq(f.key)} => ${f.file ? `new CURLFile(${sq(f.file)})` : sq(f.value)}`).join(', ')}),`);
    else if (r.body !== undefined) lines.push(`  CURLOPT_POSTFIELDS => ${sq(r.body)},`);
    if (headerEntries(r).length) lines.push(`  CURLOPT_HTTPHEADER => array(${headerEntries(r).map(([k, v]) => sq(`${k}: ${v}`)).join(', ')}),`);
    lines.push('));', '', '$response = curl_exec($curl);', 'curl_close($curl);', 'echo $response;');
    return lines.join('\n');
  },

  ruby: (r) => {
    const klass = { GET: 'Get', POST: 'Post', PUT: 'Put', PATCH: 'Patch', DELETE: 'Delete', HEAD: 'Head', OPTIONS: 'Options' }[r.method] || 'Get';
    const lines = ["require 'uri'", "require 'net/http'", '', `url = URI(${sq(r.url)})`, '', 'http = Net::HTTP.new(url.host, url.port)', "http.use_ssl = (url.scheme == 'https')", '', `request = Net::HTTP::${klass}.new(url)`];
    headerEntries(r).forEach(([k, v]) => lines.push(`request[${sq(k)}] = ${sq(v)}`));
    if (r.form.length) lines.push(`request.set_form([${r.form.map((f) => `[${sq(f.key)}, ${f.file ? `File.open(${sq(f.file)})` : sq(f.value)}]`).join(', ')}], 'multipart/form-data')`);
    else if (r.body !== undefined) lines.push(`request.body = ${sq(r.body)}`);
    lines.push('', 'response = http.request(request)', 'puts response.read_body');
    return lines.join('\n');
  },

  swift: (r) => {
    const lines = ['import Foundation', '', `var request = URLRequest(url: URL(string: ${dq(r.url)})!)`, `request.httpMethod = ${dq(r.method)}`];
    headerEntries(r).forEach(([k, v]) => lines.push(`request.addValue(${dq(v)}, forHTTPHeaderField: ${dq(k)})`));
    if (r.body !== undefined) lines.push(`request.httpBody = ${dq(r.body)}.data(using: .utf8)`);
    if (r.form.length) lines.push('// multipart/form-data: build the body with a boundary and set it as request.httpBody');
    lines.push('', 'let task = URLSession.shared.dataTask(with: request) { data, response, error in', '  guard let data = data else { print(String(describing: error)); return }', '  print(String(data: data, encoding: .utf8)!)', '}', 'task.resume()');
    return lines.join('\n');
  },

  dart: (r) => {
    const lines = ["import 'package:http/http.dart' as http;", '', 'Future<void> main() async {'];
    if (headerEntries(r).length) lines.push(`  var headers = {\n${headerEntries(r).map(([k, v]) => `    ${sq(k)}: ${sq(v)}`).join(',\n')}\n  };`);
    lines.push(`  var request = http.${r.form.length ? 'MultipartRequest' : 'Request'}(${sq(r.method)}, Uri.parse(${sq(r.url)}));`);
    if (r.form.length) {
      r.form.forEach((f) => lines.push(f.file ? `  request.files.add(await http.MultipartFile.fromPath(${sq(f.key)}, ${sq(f.file)}));` : `  request.fields[${sq(f.key)}] = ${sq(f.value)};`));
    } else if (r.body !== undefined) lines.push(`  request.body = ${sq(r.body)};`);
    if (headerEntries(r).length) lines.push('  request.headers.addAll(headers);');
    lines.push('', '  http.StreamedResponse response = await request.send();', '  print(await response.stream.bytesToString());', '}');
    return lines.join('\n');
  },

  powershell: (r) => {
    const lines = [];
    if (headerEntries(r).length) lines.push('$headers = @{', ...headerEntries(r).map(([k, v]) => `  ${psq(k)} = ${psq(v)}`), '}');
    const args = [`-Uri ${psq(r.url)}`, `-Method ${r.method}`];
    if (headerEntries(r).length) args.push('-Headers $headers');
    if (r.form.length) {
      lines.push('$form = @{', ...r.form.map((f) => `  ${psq(f.key)} = ${f.file ? `Get-Item -Path ${psq(f.file)}` : psq(f.value)}`), '}');
      args.push('-Form $form');
    } else if (r.body !== undefined) {
      lines.push(`$body = ${psq(r.body)}`);
      args.push('-Body $body');
    }
    lines.push(`$response = Invoke-RestMethod ${args.join(' ')}`, '$response | ConvertTo-Json');
    return lines.join('\n');
  },
};

export const LANGUAGES = [
  { id: 'curl', label: 'cURL', gen: generators.curl },
  { id: 'csharp', label: 'C# - HttpClient', gen: generators.csharp },
  { id: 'dart', label: 'Dart - http', gen: generators.dart },
  { id: 'go', label: 'Go - Native', gen: generators.go },
  { id: 'http', label: 'HTTP', gen: generators.http },
  { id: 'javaOkHttp', label: 'Java - OkHttp', gen: generators.javaOkHttp },
  { id: 'jsFetch', label: 'JavaScript - Fetch', gen: generators.jsFetch },
  { id: 'jsAxios', label: 'JavaScript - Axios', gen: generators.jsAxios },
  { id: 'php', label: 'PHP - cURL', gen: generators.php },
  { id: 'powershell', label: 'PowerShell - RestMethod', gen: generators.powershell },
  { id: 'python', label: 'Python - Requests', gen: generators.python },
  { id: 'ruby', label: 'Ruby - Net::HTTP', gen: generators.ruby },
  { id: 'swift', label: 'Swift - URLSession', gen: generators.swift },
];

export function generateSnippet(languageId, prepared) {
  const lang = LANGUAGES.find((l) => l.id === languageId) || LANGUAGES[0];
  return lang.gen(normalize(prepared));
}
