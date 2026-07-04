# TODO

## Mongo/Cloudinary connectivity fixes
- [ ] Update `server.js` to make Cloudinary verification non-fatal and version-agnostic (remove dependency on `cloudinary.api.account()`)
- [ ] Update `server.js` MongoDB verification logging for clearer ECONNREFUSED/SRV DNS/network hints
- [ ] Keep server startup non-blocking (do not crash on verification errors)
- [ ] Run `npm run dev` and confirm logs / endpoints work (`/api/health`)

