from app.styles.catalog import all_recipes, get_recipe


def test_catalog_has_many_distinct_recipes():
    recipes = all_recipes()
    assert len(recipes) >= 40
    slugs = [r.slug for r in recipes]
    assert len(slugs) == len(set(slugs))  # no dupes


def test_every_recipe_has_cues_and_qualifiers():
    for r in all_recipes():
        assert r.positive_cues.strip(), f"{r.slug} missing positive_cues"
        assert r.negative_cues.strip(), f"{r.slug} missing negative_cues"
        assert "stencil-ready" in r.base_qualifiers
        assert {"color", "line_weight", "complexity"} <= set(r.default_modifiers)


def test_known_styles_present():
    known = ["fine-line", "blackwork", "american-traditional", "japanese-irezumi", "watercolor"]
    for slug in known:
        assert get_recipe(slug) is not None, f"{slug} missing from catalog"


async def test_styles_endpoint_public_fields_only(client):
    r = await client.get("/api/styles")
    assert r.status_code == 200
    styles = r.json()
    assert len(styles) >= 40
    sample = styles[0]
    assert set(sample) == {"slug", "name", "category", "description", "tags", "default_modifiers"}
    # secret-sauce cues must NOT leak to the client
    assert "positive_cues" not in sample
