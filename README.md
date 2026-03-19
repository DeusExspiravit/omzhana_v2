# Omzhana Storefront

Omzhana is a Django storefront for browsing curated pantry and food products, opening category menus, using the in-page storefront assistant, and managing a client-side cart.

## Stack

- Django 5
- Shopify Storefront API for live catalog data
- Static frontend assets in `website/store/static/store/`
- SQLite by default

## Local Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy the environment template and fill in Shopify values if you have them:

```bash
cp .env.example .env
```

4. Run migrations and start the dev server:

```bash
cd website
python manage.py migrate
python manage.py runserver
```

The app will fall back to local sample products if Shopify credentials are not configured.

## Environment Variables

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `DATABASE_PATH`
- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_STOREFRONT_TOKEN`
- `SHOPIFY_API_VERSION`

## Render Deployment

This repo includes a `render.yaml` for one Django web service.

### What it does

- installs dependencies from `requirements.txt`
- runs `collectstatic`
- runs `migrate`
- starts Gunicorn with `website.wsgi:application`
- mounts a persistent disk at `/var/data` for SQLite

### Deploy steps

1. Push this repo to GitHub.
2. In Render, create a new Blueprint instance from the repository.
3. Confirm the generated web service.
4. Set the Shopify environment variables in Render:
   - `SHOPIFY_STORE_DOMAIN`
   - `SHOPIFY_STOREFRONT_TOKEN`
5. Deploy.

### Notes

- `DJANGO_DEBUG` is set to `false` in Render.
- `DATABASE_PATH` points to `/var/data/db.sqlite3` so SQLite persists across deploys.
- `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` are set for `*.onrender.com`.

## Project Structure

- `website/manage.py`
- `website/website/settings.py`
- `website/store/templates/store/`
- `website/store/static/store/`
- `render.yaml`

## Production Check

```bash
cd website
python manage.py check
```
