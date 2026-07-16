# Fix branding Lopest v2

Corrige dos problemas:

1. El logo de sidebar ya no se sirve desde `/brand/...`; se importa estáticamente desde `web/src/assets/lopest-logo.png`, por lo que Next lo valida y empaqueta durante el build.
2. El favicon usa una marca simplificada: squircle con gradiente Lopest y símbolo `$` blanco. El logo completo no es legible a 16x16.

## Aplicar

```bash
cd ~/apps/lopest
node scripts/apply-lopest-branding-fix-v2.mjs
```

## Validar

```bash
cd ~/apps/lopest/web
pnpm validate
```

## Deploy

```bash
cd ~/apps/lopest
git status --short
git diff --stat
git add -A
git commit --amend --no-edit
git push --force-with-lease
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build web
```

Después del deploy, abrir una pestaña privada o cerrar y reabrir la pestaña para evitar la caché del favicon.
