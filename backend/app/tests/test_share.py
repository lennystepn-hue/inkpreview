"""Public per-design share pages with Open Graph tags."""


async def _auth(client) -> dict[str, str]:
    token = (await client.post("/api/session")).json()["token"]
    return {"Authorization": f"Bearer {token}"}


async def test_share_page_renders_og_tags(client):
    h = await _auth(client)
    did = (
        await client.post(
            "/api/designs", json={"prompt": "a phoenix rising", "styles": []}, headers=h
        )
    ).json()["id"]
    r = await client.get(f"/d/{did}")
    assert r.status_code == 200
    body = r.text
    assert 'property="og:image"' in body
    assert 'name="twitter:card"' in body
    assert "phoenix rising" in body  # prompt in title/description
    assert f"/d/{did}" in body  # canonical + og:url


async def test_share_page_404_still_has_og(client):
    r = await client.get("/d/does-not-exist")
    assert r.status_code == 404
    assert "og:image" in r.text  # graceful fallback page


async def test_style_landing_page(client):
    styles = (await client.get("/api/styles")).json()
    slug = styles[0]["slug"]
    r = await client.get(f"/style/{slug}")
    assert r.status_code == 200
    assert "og:image" in r.text
    assert styles[0]["name"] in r.text
    # Rich SEO content: FAQ schema, breadcrumbs, hreflang pair, crawl mesh.
    assert '"FAQPage"' in r.text
    assert '"BreadcrumbList"' in r.text
    assert f'hreflang="de" href="http://test/de/style/{slug}"' in r.text.replace(
        "https://ink-preview.com", "http://test"
    ) or 'hreflang="de"' in r.text
    assert "/tattoo/forearm" in r.text  # mesh links to body parts
    assert (await client.get("/style/not-a-real-style")).status_code == 404


async def test_style_landing_page_german(client):
    styles = (await client.get("/api/styles")).json()
    slug = styles[0]["slug"]
    r = await client.get(f"/de/style/{slug}")
    assert r.status_code == 200
    assert '<html lang="de">' in r.text
    assert "So funktioniert" in r.text  # German how-it-works
    assert "/de/tattoo/" in r.text  # mesh stays in German


async def test_bodypart_landing_page(client):
    r = await client.get("/tattoo/forearm")
    assert r.status_code == 200
    assert "Forearm" in r.text
    assert '"FAQPage"' in r.text
    assert (await client.get("/tattoo/not-a-part")).status_code == 404

    de = await client.get("/de/tattoo/forearm")
    assert de.status_code == 200
    assert "Unterarm" in de.text


async def test_dynamic_sitemap_lists_styles_and_parts(client):
    r = await client.get("/sitemap.xml")
    assert r.status_code == 200
    assert "xml" in r.headers["content-type"]
    styles = (await client.get("/api/styles")).json()
    assert f"/style/{styles[0]['slug']}" in r.text
    assert f"/de/style/{styles[0]['slug']}" in r.text
    assert "/tattoo/forearm" in r.text
    assert "/de/tattoo/forearm" in r.text
    assert "hreflang=" in r.text  # xhtml:link alternates present
    assert "/explore" in r.text
