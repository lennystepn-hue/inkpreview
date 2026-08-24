from app.imaging.engine import GenSpec, Placement
from app.imaging.prompts import build_composite_prompt, build_generation_prompt
from app.styles.catalog import get_recipe


def test_generation_prompt_includes_subject_style_and_rules():
    spec = GenSpec(prompt="a howling wolf", style_slugs=["fine-line"], color=False)
    p = build_generation_prompt(spec)
    assert "howling wolf" in p
    recipe = get_recipe("fine-line")
    first_cue = recipe.positive_cues.split(",")[0].strip()
    assert first_cue in p
    assert "stencil-ready" in p
    assert "black and grey" in p.lower()


def test_generation_prompt_includes_negatives():
    spec = GenSpec(prompt="rose", style_slugs=["blackwork"])
    assert "Avoid:" in build_generation_prompt(spec)


def test_generation_prompt_handles_unknown_style_with_fallback():
    p = build_generation_prompt(GenSpec(prompt="star", style_slugs=["nope-not-real"]))
    assert "star" in p
    assert "no skin" in p  # default base qualifiers applied


def test_composite_prompt_preserves_motif_and_size():
    cp = build_composite_prompt(Placement(x_pct=0.5, y_pct=0.5, scale=0.5))
    assert "straighten" in cp.lower()
    assert "rotation" in cp.lower()
    assert "large" in cp.lower()
    assert "skin" in cp.lower()
