Apple「Sign in with Apple JS」需要網域驗證檔放喺：
  https://app.kindcipe.com/.well-known/apple-developer-domain-association.txt

取得方法：
  1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → Services IDs
  2. 揀 com.kindcipe.web → Sign In with Apple → Configure
  3. Domains and Subdomains: app.kindcipe.com
  4. Return URLs: https://app.kindcipe.com
  5. Download（會下載 apple-developer-domain-association.txt）
  6. 把檔案放喺呢個 folder（檔名要完全一致），然後通知 Hermes 重新 deploy
