# Plan - Auth protection for write.html

- Add Basic Auth middleware to protect API endpoints used by write/admin pages.
- Add Login Prompt overlay on write.html.
- Hide editor + article list until authenticated.
- Send Authorization header on every request from write.html.

Endpoints to protect:
- GET /api/articles
- POST /api/uploads/image
- POST /save-article
- POST /api/publish
- PUT /api/articles/:id
- DELETE /api/articles/:id

