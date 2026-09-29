# linefax-liff

LINE FAX（処方せん送信）の受付画面（LIFF）の公開用ファイル置き場です。
秘密の値・患者さんの情報は置きません。店舗ごとにフォルダを分けます。

- 公開アドレス: `https://line.yakusokuai.jp/<店舗フォルダ>/`（GitHub Pages＋独自ドメイン。DNS は お名前.com の CNAME `line` → `sanrokun3610.github.io`）
- `shimoyoshida/` … サンロード調剤 下吉田店

## 店舗を増やすとき

1. 元のリポジトリ `project-line-fax` の `live/sanrokun-fujikawa-liff/` から `index.html` `app.js` `sdk.js` `style.css` `config.js` を新しいフォルダ（例 `masuho/`）に複製する。
2. `config.js` の `liffId` と `gasUrl` をその店の値にする（公開してよい値だけ。鍵は置かない）。
3. LINE Developers の LIFF「エンドポイント URL」を `https://line.yakusokuai.jp/<店舗フォルダ>/` にする。
4. 画面を直したら `index.html` の `APP_VERSION` を上げる（LINE 内ブラウザの古い表示を強制更新するため）。
