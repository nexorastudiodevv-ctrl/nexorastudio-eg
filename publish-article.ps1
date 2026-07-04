$body = @{
  title = 'اختبار حفظ API'
  date = '2026-07-04'
  category = 'Testing'
  tags = 'اختبار,API'
  excerpt = 'تمت إضافة هذه المقالة عبر API'
  icon = 'fa-solid fa-check'
  url = 'article-api-test.html'
  image = ''
  content = 'محتوى اختبار لحفظ المقال عبر الـ API'
} | ConvertTo-Json -Compress

Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/publish' -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing | Out-Null
